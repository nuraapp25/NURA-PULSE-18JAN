import { AppState } from './types';
import React, { useState, useMemo, useEffect } from 'react';
import Papa from 'papaparse';
import { read, utils } from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from 'recharts';
import { Upload, Map, Download, Settings, Activity, Cpu, FileText, MapPin, Car, AlertTriangle, FileJson, FileDown, Ban, UserX, CheckCircle2, Sun, Moon, Globe, Layers, ArrowRight, TrendingUp, Zap, LayoutDashboard, Filter } from 'lucide-react';

import { processRideData, generateCSVContent, optimizeFleetDistribution, generateJSONContent, generateStatusCSV, buildStatusClusters, generatePickupDropPointCSV, generateRawDataWithHexCSV, VALID_HEX_IDS } from './h3Helper';
import { getPacingStrategy } from './geminiService';
import { Spinner } from './Spinner';
import { MapVisualizer } from './MapVisualizer';
import { MultiDatePicker } from './MultiDatePicker';
import './hex-hotspots.css';


const HexHotspots = () => {
    const [appState, setAppState] = useState(AppState.UPLOAD);

    // Cluster Data Buckets
    const [baseClustersAll, setBaseClustersAll] = useState([]);
    const [baseClustersMorning, setBaseClustersMorning] = useState([]);
    const [baseClustersEvening, setBaseClustersEvening] = useState([]);

    // UI State
    const [timeView, setTimeView] = useState('ALL');
    const [startHour, setStartHour] = useState('ALL');
    const [endHour, setEndHour] = useState('ALL');
    const [mapMetric, setMapMetric] = useState('DEMAND');
    const [locationType, setLocationType] = useState('PICKUP');
    const [mapStatusFilter, setMapStatusFilter] = useState(['ALL']);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedDates, setSelectedDates] = useState([]);
    const [sortField, setSortField] = useState('demandScore');
    const [sortDirection, setSortDirection] = useState('desc');

    // Keep raw data for status filtering
    const [rawRideData, setRawRideData] = useState([]);

    const [config, setConfig] = useState({
        h3Resolution: 8,
        targetSlaMinutes: 5,
        avgTripTimeMinutes: 25,
        driverEfficiency: 0.85
    });

    // Fleet Optimization State
    const [isFleetConstrained, setIsFleetConstrained] = useState(false);
    const [fleetSize, setFleetSize] = useState(0);

    // Debug Stats
    const [debugStats, setDebugStats] = useState(null);

    const [aiInsight, setAiInsight] = useState("");
    const [loadingAi, setLoadingAi] = useState(false);

    // Select the correct base clusters based on the tab view
    const currentBaseClusters = useMemo(() => {
        switch (timeView) {
            case 'MORNING': return baseClustersMorning;
            case 'EVENING': return baseClustersEvening;
            default: return baseClustersAll;
        }
    }, [timeView, baseClustersAll, baseClustersMorning, baseClustersEvening]);

    // Derived clusters based on fleet constraints for the CURRENT VIEW
    const displayClusters = useMemo(() => {
        if (currentBaseClusters.length === 0) return [];

        // 1. Filter Logic (Fish Bowl)
        let clusters = [...currentBaseClusters];
        if (mapStatusFilter.includes('FISH_BOWL')) {
            clusters = clusters.filter(c => VALID_HEX_IDS.has(c.hexId));
        }

        // 2. NO Optimization for Main Map (Visualization Only)
        // Just return the clusters as they are (with ideal supply)

        // Apply sorting
        return clusters.sort((a, b) => {
            let aVal = a[sortField];
            let bVal = b[sortField];

            if (sortField === 'hexId') {
                aVal = aVal?.toString() || '';
                bVal = bVal?.toString() || '';
            }

            if (aVal === bVal) return 0;
            const comparison = aVal > bVal ? 1 : -1;
            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [currentBaseClusters, mapStatusFilter, sortField, sortDirection]);

    // Separate Optimization Logic (Strictly Fish Bowl)
    const optimizedClusters = useMemo(() => {
        if (currentBaseClusters.length === 0) return [];
        // optimizeFleetDistribution now internally filters for VALID_HEX_IDS
        return optimizeFleetDistribution(currentBaseClusters, isFleetConstrained ? fleetSize : null);
    }, [currentBaseClusters, isFleetConstrained, fleetSize]);

    // Map clusters can be switched between overall and status-based views
    const mapClusters = useMemo(() => {
        if (mapMetric === 'SLA') {
            return displayClusters;
        }

        // Demand view - filter by status if needed
        // If ALL is selected, OR if FISH_BOWL is the only selection (which implies ALL spatially filtered)
        if (mapStatusFilter.includes('ALL') || (mapStatusFilter.length === 1 && mapStatusFilter.includes('FISH_BOWL'))) {
            return displayClusters;
        } else {
            const dateFilter = startDate || endDate || selectedDates.length > 0 ? {
                startDate: startDate ? new Date(startDate) : null,
                endDate: endDate ? new Date(endDate) : null,
                timeView: timeView,
                selectedDates: selectedDates
            } : undefined;

            return buildStatusClusters(
                rawRideData,
                mapStatusFilter,
                config,
                locationType,
                dateFilter,
                startHour,
                endHour
            );
        }
    }, [mapMetric, mapStatusFilter, displayClusters, rawRideData, config, locationType, startDate, endDate, selectedDates, timeView, startHour, endHour]);

    // Calculate totals based on what is actually shown on the map (mapClusters)
    // This ensures the top-line "Total Demand" matches the same filtered slice the user sees.
    const totalDemand = useMemo(() =>
        mapClusters.reduce((sum, c) => sum + (c.demand || 0), 0)
        , [mapClusters]);
    const totalIdealSupply = useMemo(() => mapClusters.reduce((sum, c) => sum + c.requiredSupply, 0), [mapClusters]);

    // Allocated Supply comes from OPTIMIZED clusters
    const totalAllocatedSupply = useMemo(() => optimizedClusters.reduce((sum, c) => sum + c.allocatedSupply, 0), [optimizedClusters]);

    const avgSlaScore = useMemo(() => {
        if (optimizedClusters.length === 0) return 0;
        const sumScore = optimizedClusters.reduce((sum, c) => sum + c.slaComplianceScore, 0);
        return Math.round(sumScore / optimizedClusters.length);
    }, [optimizedClusters]);

    // Status Counts
    const statusCounts = useMemo(() => {
        const counts = { completed: 0, cancelled: 0, driverNotFound: 0 };
        rawRideData.forEach(row => {
            const status = (row.rideStatus || row.status || '').toString().toUpperCase();
            if (status === 'COMPLETED') counts.completed++;
            if (status === 'CANCELLED') counts.cancelled++;
            if (status === 'DRIVER_NOT_FOUND') counts.driverNotFound++;
        });
        return counts;
    }, [rawRideData]);

    // Initialize fleet size recommendation when data loads
    useEffect(() => {
        if (currentBaseClusters.length > 0 && fleetSize === 0) {
            const ideal = currentBaseClusters.reduce((sum, c) => sum + c.requiredSupply, 0);
            setFleetSize(Math.round(ideal * 0.8));
        }
    }, [currentBaseClusters]);

    const handleFileUpload = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setAppState(AppState.PROCESSING);

        const fileExtension = file.name.split('.').pop()?.toLowerCase();

        if (fileExtension === 'xlsx' || fileExtension === 'xls') {
            const reader = new FileReader();
            reader.onload = (e) => {
                const data = e.target?.result;
                if (data) {
                    try {
                        const workbook = read(data, { type: 'array' });
                        const firstSheetName = workbook.SheetNames[0];
                        const worksheet = workbook.Sheets[firstSheetName];
                        const jsonData = utils.sheet_to_json(worksheet, { raw: false });

                        setRawRideData(jsonData);

                        // Process splits with date filter if set
                        const dateFilter = startDate || endDate || selectedDates.length > 0 ? {
                            startDate: startDate ? new Date(startDate) : null,
                            endDate: endDate ? new Date(endDate) : null,
                            timeView: timeView,
                            selectedDates: selectedDates
                        } : undefined;

                        const processed = processRideData(jsonData, config, dateFilter, locationType, startHour, endHour);
                        setBaseClustersAll(processed.allDay);
                        setBaseClustersMorning(processed.morning);
                        setBaseClustersEvening(processed.evening);
                        setDebugStats(processed.debugStats);

                        setAppState(AppState.DASHBOARD);
                    } catch (error) {
                        console.error("Excel Error", error);
                        alert("Error parsing Excel file");
                        setAppState(AppState.UPLOAD);
                    }
                }
            };
            reader.readAsArrayBuffer(file);
        } else {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    const rawData = results.data;
                    setRawRideData(rawData);

                    // Process splits with date filter if set
                    const dateFilter = startDate || endDate || selectedDates.length > 0 ? {
                        startDate: startDate ? new Date(startDate) : null,
                        endDate: endDate ? new Date(endDate) : null,
                        timeView: timeView,
                        selectedDates: selectedDates
                    } : undefined;

                    const processed = processRideData(rawData, config, dateFilter, locationType, startHour, endHour);
                    setBaseClustersAll(processed.allDay);
                    setBaseClustersMorning(processed.morning);
                    setBaseClustersEvening(processed.evening);
                    setDebugStats(processed.debugStats);

                    // Build status-based clusters for map views


                    setAppState(AppState.DASHBOARD);
                },
                error: (err) => {
                    console.error("CSV Error", err);
                    alert("Error parsing CSV");
                    setAppState(AppState.UPLOAD);
                }
            });
        }
    };

    // Apply date filter when dates or timeView changes
    useEffect(() => {
        if (rawRideData.length > 0) {
            const dateFilter = startDate || endDate || selectedDates.length > 0 ? {
                startDate: startDate ? new Date(startDate) : null,
                endDate: endDate ? new Date(endDate) : null,
                timeView: timeView,
                selectedDates: selectedDates
            } : undefined;

            const processed = processRideData(rawRideData, config, dateFilter, locationType, startHour, endHour);
            setBaseClustersAll(processed.allDay);
            setBaseClustersMorning(processed.morning);
            setBaseClustersEvening(processed.evening);
            setDebugStats(processed.debugStats);

            // Rebuild status clusters if location type changes

        }
    }, [startDate, endDate, selectedDates, timeView, config, locationType, startHour, endHour]);

    // Download Handler for Supply Plans
    const handleDownloadSupplyPlan = (type) => {
        let targetClusters = [];
        let filename = "supply_plan.csv";

        switch (type) {
            case 'MORNING':
                targetClusters = isFleetConstrained ? optimizeFleetDistribution(baseClustersMorning, fleetSize) : baseClustersMorning;
                filename = "morning_supply_plan_chennai.csv";
                break;
            case 'EVENING':
                targetClusters = isFleetConstrained ? optimizeFleetDistribution(baseClustersEvening, fleetSize) : baseClustersEvening;
                filename = "evening_supply_plan_chennai.csv";
                break;
            default:
                targetClusters = optimizedClusters;
                filename = "full_day_supply_plan_chennai.csv";
                break;
        }

        const csvContent = generateCSVContent(targetClusters);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadJSON = () => {
        const jsonContent = generateJSONContent(optimizedClusters);
        const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'ride_clusters.json');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadStatus = (status, filename) => {
        const csvContent = generateStatusCSV(rawRideData, status, config);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${filename}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadPickupDrop = (mode) => {
        const csvContent = generatePickupDropPointCSV(rawRideData, mode);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', mode === 'PICKUP' ? 'pickup_points.csv' : 'drop_points.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    const handleDownloadRawDataWithHex = () => {
        const csvContent = generateRawDataWithHexCSV(rawRideData, config);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'raw_data_with_hex_and_distance.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const fetchAiInsights = async () => {
        setLoadingAi(true);
        const insight = await getPacingStrategy(optimizedClusters, totalDemand, totalAllocatedSupply);
        setAiInsight(insight);
        setLoadingAi(false);
    };

    // Prepare chart data (Top 10 hotspots)
    const chartData = useMemo(() => {
        return optimizedClusters.slice(0, 10).map(c => ({
            name: c.hexId.substring(0, 6) + '...',
            Demand: c.demand,
            Ideal: c.requiredSupply,
            Allocated: c.allocatedSupply
        }));
    }, [optimizedClusters]);

    // Prepare line chart data for SLA Trend
    const slaTrendData = useMemo(() => {
        return optimizedClusters.slice(0, 10).map(c => ({
            name: c.hexId.substring(0, 6) + '...',
            fullHex: c.hexId,
            Score: c.slaComplianceScore,
            Demand: c.demand
        }));
    }, [optimizedClusters]);

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
            <header className="sticky top-0 z-50 glass-panel border-b-0 rounded-b-2xl mx-4 mt-2 mb-8">
                <div className="w-full px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-2.5 rounded-xl shadow-lg shadow-indigo-500/30">
                            <Map className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-display">RideFlow <span className="text-indigo-600">Optimizer</span></h1>
                            <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                <span className="text-xs text-slate-500 font-medium tracking-wide uppercase">Chennai Edition</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {appState === AppState.DASHBOARD && (
                            <button
                                onClick={() => setAppState(AppState.UPLOAD)}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            >
                                <Upload className="w-4 h-4" />
                                New Upload
                            </button>
                        )}
                        <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white shadow-sm overflow-hidden">
                            <img src="https://ui-avatars.com/api/?name=Admin&background=6366f1&color=fff" alt="Profile" />
                        </div>
                    </div>
                </div>
            </header>

            <main className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {appState === AppState.UPLOAD && (
                    // UPLOAD_PLACEHOLDER
                    <div className="max-w-2xl mx-auto mt-20">
                        <div className="glass-card rounded-3xl p-12 text-center relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
                            <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-8 group-hover:scale-110 transition-transform duration-300">
                                <Upload className="w-10 h-10 text-indigo-600" />
                            </div>
                            <h2 className="text-3xl font-bold text-slate-900 mb-4 font-display">Upload Ride Data</h2>
                            <p className="text-slate-500 mb-10 text-lg max-w-md mx-auto leading-relaxed">
                                Upload your CSV file containing ride coordinates and timestamps. We&apos;ll generate optimized supply plans for Chennai.
                            </p>

                            <div className="relative max-w-md mx-auto">
                                <input
                                    type="file"
                                    accept=".csv,.xlsx,.xls"
                                    onChange={handleFileUpload}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                />
                                <button className="w-full btn-primary py-4 px-8 rounded-xl font-semibold text-lg flex items-center justify-center gap-3">
                                    <FileText className="w-5 h-5" />
                                    Select File
                                </button>
                                <p className="text-xs text-slate-400 mt-4">Supported formats: .csv, .xlsx, .xls (Max 10MB)</p>
                            </div>
                        </div>
                    </div>
                )}

                {appState === AppState.PROCESSING && (
                    <div className="flex flex-col items-center justify-center h-[60vh]">
                        <Spinner />
                        <p className="mt-4 text-slate-500 font-medium animate-pulse">Processing Ride Data...</p>
                    </div>
                )}

                {appState === AppState.DASHBOARD && (
                    <div className="space-y-8 animate-fade-in">
                        {/* Controls Section */}
                        <div className="flex flex-col xl:flex-row gap-6">
                            {/* Time & Date Controls */}
                            <div className="glass-panel p-2 rounded-2xl flex flex-col sm:flex-row gap-2 w-full xl:w-auto relative z-20">
                                <div className="flex bg-slate-100/50 p-1 rounded-xl">
                                    {(['ALL', 'MORNING', 'EVENING']).map((view) => (
                                        <button
                                            key={view}
                                            onClick={() => setTimeView(view)}
                                            className={`flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-lg transition-all duration-300 ${timeView === view
                                                ? 'bg-white text-indigo-600 shadow-md scale-105'
                                                : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                                                }`}
                                        >
                                            {view === 'ALL' && <Globe className="w-4 h-4" />}
                                            {view === 'MORNING' && <Sun className="w-4 h-4" />}
                                            {view === 'EVENING' && <Moon className="w-4 h-4" />}
                                            {view === 'ALL' ? 'All Day' : view.charAt(0) + view.slice(1).toLowerCase()}
                                        </button>
                                    ))}
                                </div>

                                <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm flex-1 sm:flex-none">
                                    <Filter className="w-4 h-4 text-slate-400" />
                                    <MultiDatePicker
                                        selectedDates={selectedDates}
                                        onDateChange={(dates) => {
                                            setSelectedDates(dates);
                                            // Reset range inputs if using multi-select to avoid confusion?
                                            // Or keep them independent. For now, let's just clear range if multi is used
                                            if (dates.length > 0) {
                                                setStartDate('');
                                                setEndDate('');
                                            }
                                        }}
                                    />
                                    <span className="text-slate-300">|</span>
                                    <div className="flex items-center gap-1">
                                        <span className="text-xs text-slate-400 font-bold">FROM</span>
                                        <select
                                            value={startHour}
                                            onChange={(e) => setStartHour(e.target.value === 'ALL' ? 'ALL' : parseInt(e.target.value))}
                                            className="border-none bg-transparent text-sm font-medium focus:ring-0 p-0 text-slate-600 cursor-pointer w-16"
                                        >
                                            <option value="ALL">All</option>
                                            {[...Array(24).keys()].map(h => (
                                                <option key={h} value={h}>{h.toString().padStart(2, '0')}:00</option>
                                            ))}
                                        </select>
                                    </div>
                                    <span className="text-slate-300">|</span>
                                    <div className="flex items-center gap-1">
                                        <span className="text-xs text-slate-400 font-bold">TO</span>
                                        <select
                                            value={endHour}
                                            onChange={(e) => setEndHour(e.target.value === 'ALL' ? 'ALL' : parseInt(e.target.value))}
                                            className="border-none bg-transparent text-sm font-medium focus:ring-0 p-0 text-slate-600 cursor-pointer w-16"
                                        >
                                            <option value="ALL">All</option>
                                            {[...Array(24).keys()].map(h => (
                                                <option key={h} value={h}>{h.toString().padStart(2, '0')}:00</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Fleet Optimization */}
                            <div className="glass-panel p-4 rounded-2xl flex-1 flex items-center justify-between gap-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 shadow-sm">
                                        <Car className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-800">Fleet Optimization</h3>
                                        <p className="text-xs text-slate-500 font-medium">Smart Allocation</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6">
                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <div className="relative">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={isFleetConstrained}
                                                onChange={(e) => setIsFleetConstrained(e.target.checked)}
                                            />
                                            <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-indigo-600 shadow-inner"></div>
                                        </div>
                                        <span className="text-sm font-medium text-slate-600 group-hover:text-indigo-600 transition-colors">Limit Fleet</span>
                                    </label>

                                    <div className={`flex items-center gap-3 transition-all duration-300 ${isFleetConstrained ? 'opacity-100 translate-x-0' : 'opacity-50 translate-x-4 pointer-events-none'}`}>
                                        <input
                                            type="number"
                                            className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-center focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                            value={fleetSize}
                                            onChange={(e) => setFleetSize(parseInt(e.target.value) || 0)}
                                            disabled={!isFleetConstrained}
                                        />
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Autos</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="glass-card p-6 rounded-2xl relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Activity className="w-24 h-24 text-blue-600" />
                                </div>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-3 bg-blue-50 rounded-xl text-blue-600 shadow-sm group-hover:scale-110 transition-transform">
                                        <Activity className="w-6 h-6" />
                                    </div>
                                    <span className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Total Demand</span>
                                </div>
                                <p className="text-4xl font-bold text-slate-900 tracking-tight">{totalDemand.toLocaleString()}</p>
                                <p className="text-sm text-slate-400 mt-2 font-medium">Across {displayClusters.length} Clusters</p>
                                {totalDemand === 0 && (
                                    <p className="text-xs text-red-500 mt-1 font-bold animate-pulse">
                                        Check Data Health Card →
                                    </p>
                                )}
                            </div>

                            <div className="glass-card p-6 rounded-2xl relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Cpu className="w-24 h-24 text-slate-600" />
                                </div>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-3 bg-slate-100 rounded-xl text-slate-600 shadow-sm group-hover:scale-110 transition-transform">
                                        <Cpu className="w-6 h-6" />
                                    </div>
                                    <span className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Ideal Supply</span>
                                </div>
                                <p className="text-4xl font-bold text-slate-900 tracking-tight">{totalIdealSupply.toLocaleString()}</p>
                                <p className="text-sm text-slate-400 mt-2 font-medium">For 100% SLA Compliance</p>
                            </div>

                            <div className="glass-card p-6 rounded-2xl relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Car className="w-24 h-24 text-emerald-600" />
                                </div>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className={`p-3 rounded-xl shadow-sm group-hover:scale-110 transition-transform ${isFleetConstrained && totalAllocatedSupply < totalIdealSupply ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                        <Car className="w-6 h-6" />
                                    </div>
                                    <span className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Allocated</span>
                                </div>
                                <p className={`text-4xl font-bold tracking-tight ${isFleetConstrained && totalAllocatedSupply < totalIdealSupply ? 'text-amber-600' : 'text-emerald-600'}`}>
                                    {totalAllocatedSupply.toLocaleString()}
                                </p>
                                <p className="text-sm text-slate-400 mt-2 font-medium">
                                    {isFleetConstrained ? 'Optimized Distribution' : 'Matching Ideal Demand'}
                                </p>
                            </div>

                            <div className="glass-card p-4 rounded-2xl flex flex-col justify-center gap-3">
                                <button
                                    onClick={() => handleDownloadSupplyPlan('MORNING')}
                                    className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-amber-50 to-amber-100/50 hover:from-amber-100 hover:to-amber-200 text-amber-800 rounded-xl transition-all group"
                                >
                                    <div className="flex items-center gap-3">
                                        <Sun className="w-4 h-4 text-amber-600" />
                                        <span className="text-sm font-semibold">Morning Plan</span>
                                    </div>
                                    <Download className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                                <button
                                    onClick={() => handleDownloadSupplyPlan('EVENING')}
                                    className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-50 to-purple-100/50 hover:from-purple-100 hover:to-purple-200 text-purple-800 rounded-xl transition-all group"
                                >
                                    <div className="flex items-center gap-3">
                                        <Moon className="w-4 h-4 text-purple-600" />
                                        <span className="text-sm font-semibold">Evening Plan</span>
                                    </div>
                                    <Download className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                                <button
                                    onClick={() => handleDownloadSupplyPlan('ALL')}
                                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl transition-all group border border-slate-100"
                                >
                                    <div className="flex items-center gap-3">
                                        <FileDown className="w-4 h-4 text-slate-500" />
                                        <span className="text-sm font-semibold">Full Day Plan</span>
                                    </div>
                                    <Download className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                            </div>
                        </div>

                        {isFleetConstrained && totalAllocatedSupply < totalIdealSupply && (
                            <div className="bg-amber-50/80 backdrop-blur-sm border border-amber-200/60 rounded-2xl p-6 flex items-start gap-4 animate-slide-up">
                                <div className="p-2 bg-amber-100 rounded-full shrink-0">
                                    <AlertTriangle className="w-6 h-6 text-amber-600" />
                                </div>
                                <div>
                                    <h4 className="text-lg font-bold text-amber-900">Supply Deficit Detected</h4>
                                    <p className="text-amber-800 mt-1 leading-relaxed">
                                        The available fleet ({totalAllocatedSupply}) is less than the ideal requirement ({totalIdealSupply}).
                                        The optimizer has strategically distributed autos to high-demand clusters to maximize impact, but average SLA compliance is now approximately <strong className="bg-amber-100 px-1 rounded">{avgSlaScore}%</strong>.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Geospatial Map Visualization */}
                        <div className="glass-panel rounded-2xl overflow-hidden shadow-xl border-0">
                            <div className="p-4 border-b border-slate-100/50 bg-white/50 backdrop-blur-md flex flex-col md:flex-row justify-between items-center gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex bg-slate-100 p-1 rounded-lg">
                                        <button
                                            onClick={() => setLocationType('PICKUP')}
                                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${locationType === 'PICKUP' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                                }`}
                                        >
                                            Pickup
                                        </button>
                                        <button
                                            onClick={() => setLocationType('DROP')}
                                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${locationType === 'DROP' ? 'bg-white text-pink-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                                }`}
                                        >
                                            Drop
                                        </button>
                                    </div>

                                    {/* Map Metric Toggle */}
                                    <div className="flex bg-slate-100 p-1 rounded-lg">
                                        <button
                                            onClick={() => setMapMetric('DEMAND')}
                                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${mapMetric === 'DEMAND' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                                }`}
                                        >
                                            <Activity className="w-3 h-3" /> Demand
                                        </button>
                                        <button
                                            onClick={() => setMapMetric('SLA')}
                                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${mapMetric === 'SLA' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                                }`}
                                        >
                                            <Layers className="w-3 h-3" /> SLA
                                        </button>
                                    </div>

                                    {/* Map Status Filter */}
                                    <div className="flex flex-wrap gap-2 bg-slate-100 p-2 rounded-xl max-w-2xl">
                                        {[
                                            { id: 'ALL', label: 'All' },
                                            { id: 'FISH_BOWL', label: 'Fish Bowl' },
                                            { id: 'COMPLETED', label: 'Completed' },
                                            { id: 'CANCELLED', label: 'Cancelled' },
                                            { id: 'DRIVER_NOT_FOUND', label: 'DNF' },
                                            { id: 'PENDING', label: 'Pending' },
                                            { id: 'DRIVER_ASSIGNED', label: 'Assigned' },
                                            { id: 'OUTSIDE_DROP_AREA', label: 'Outside Drop' },
                                            { id: 'OUTSIDE_PICKUP_AREA', label: 'Outside Pickup' },
                                            { id: 'OUTSIDE_AREA', label: 'Outside Area' }
                                        ].map((option) => {
                                            const isActive = mapStatusFilter.includes(option.id);
                                            return (
                                                <button
                                                    key={option.id}
                                                    onClick={() => {
                                                        if (option.id === 'ALL') {
                                                            setMapStatusFilter(['ALL']);
                                                        } else {
                                                            let newFilters = mapStatusFilter.filter(f => f !== 'ALL');
                                                            if (newFilters.includes(option.id)) {
                                                                newFilters = newFilters.filter(f => f !== option.id);
                                                            } else {
                                                                newFilters.push(option.id);
                                                            }
                                                            if (newFilters.length === 0) newFilters = ['ALL'];
                                                            setMapStatusFilter(newFilters);
                                                        }
                                                    }}
                                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all border ${isActive
                                                        ? 'bg-white text-indigo-600 border-indigo-200 shadow-sm'
                                                        : 'bg-transparent text-slate-500 border-transparent hover:bg-white/50 hover:text-slate-700'
                                                        }`}
                                                >
                                                    {option.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                            <div className="w-full relative" style={{ height: '600px' }}>
                                <MapVisualizer clusters={mapClusters} metric={mapMetric} />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Main Chart */}
                            <div className="lg:col-span-2 glass-card p-6 rounded-2xl">
                                <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                                    <BarChart className="w-5 h-5 text-indigo-600" />
                                    Supply Allocation vs Demand (Top 10)
                                </h3>
                                <div className="h-80 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                            <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                            <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                            <Tooltip
                                                cursor={{ fill: '#f1f5f9' }}
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                            <Bar dataKey="Demand" fill="#94a3b8" name="Demand" radius={[4, 4, 0, 0]} barSize={20} />
                                            <Bar dataKey="Ideal" fill="#cbd5e1" name="Ideal Supply" radius={[4, 4, 0, 0]} barSize={20} />
                                            <Bar dataKey="Allocated" fill={isFleetConstrained ? "#f59e0b" : "#10b981"} name="Allocated Supply" radius={[4, 4, 0, 0]} barSize={20} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* AI Strategy Panel */}
                            <div className="glass-card p-6 rounded-2xl flex flex-col h-full border-t-4 border-t-purple-500">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                                        <Zap className="w-5 h-5" />
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-800">AI Pacing Strategy</h3>
                                </div>
                                <div className="flex-1 bg-slate-50/50 rounded-xl p-4 overflow-y-auto border border-slate-100 text-sm text-slate-600 h-[300px] custom-scrollbar">
                                    {!aiInsight && !loadingAi && (
                                        <div className="flex flex-col items-center justify-center h-full space-y-4 opacity-60">
                                            <FileText className="w-12 h-12 text-slate-300" />
                                            <p>Generate insights for {timeView} data.</p>
                                        </div>
                                    )}
                                    {loadingAi && (
                                        <div className="flex flex-col items-center justify-center h-full space-y-4">
                                            <Spinner />
                                            <p className="text-purple-600 font-medium animate-pulse">Analyzing {timeView} patterns...</p>
                                        </div>
                                    )}
                                    {aiInsight && (
                                        <div className="prose prose-sm max-w-none whitespace-pre-wrap font-medium leading-relaxed">
                                            {aiInsight}
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={fetchAiInsights}
                                    disabled={loadingAi}
                                    className="mt-4 w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-lg shadow-purple-500/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    {loadingAi ? 'Generating Strategy...' : 'Generate AI Strategy'}
                                </button>
                            </div>
                        </div>

                        {/* SLA Trend Chart */}
                        <div className="glass-card p-6 rounded-2xl">
                            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-emerald-600" />
                                SLA Compliance Trend (Top 10 High Demand Clusters)
                            </h3>
                            <div className="h-64 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={slaTrendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                        <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#64748b" fontSize={12} domain={[0, 100]} tickLine={false} axisLine={false} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                            labelStyle={{ color: '#475569', fontWeight: 600 }}
                                        />
                                        <Legend />
                                        <Line type="monotone" dataKey="Score" stroke="#8b5cf6" strokeWidth={3} name="SLA Score (%)" activeDot={{ r: 6, strokeWidth: 0 }} dot={{ r: 4, strokeWidth: 0 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Ride Status Analytics & Export */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="glass-card p-5 rounded-2xl flex flex-col hover:border-green-200 transition-colors">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-green-100 rounded-md text-green-700">
                                            <CheckCircle2 className="w-4 h-4" />
                                        </div>
                                        <span className="text-sm font-bold text-slate-700">Completed</span>
                                    </div>
                                    <span className="text-2xl font-bold text-green-600">{statusCounts.completed.toLocaleString()}</span>
                                </div>
                                <button
                                    onClick={() => handleDownloadStatus('COMPLETED', 'completed_rides')}
                                    className="mt-auto w-full py-2 px-3 bg-slate-50 hover:bg-green-50 text-slate-600 hover:text-green-700 text-xs font-bold rounded-lg border border-slate-200 hover:border-green-200 flex items-center justify-center gap-2 transition-all"
                                >
                                    <FileDown className="w-3 h-3" /> Export to Kepler
                                </button>
                            </div>

                            <div className="glass-card p-5 rounded-2xl flex flex-col hover:border-red-200 transition-colors">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-red-100 rounded-md text-red-700">
                                            <Ban className="w-4 h-4" />
                                        </div>
                                        <span className="text-sm font-bold text-slate-700">Cancelled</span>
                                    </div>
                                    <span className="text-2xl font-bold text-red-600">{statusCounts.cancelled.toLocaleString()}</span>
                                </div>
                                <button
                                    onClick={() => handleDownloadStatus('CANCELLED', 'cancelled_rides')}
                                    className="mt-auto w-full py-2 px-3 bg-slate-50 hover:bg-red-50 text-slate-600 hover:text-red-700 text-xs font-bold rounded-lg border border-slate-200 hover:border-red-200 flex items-center justify-center gap-2 transition-all"
                                >
                                    <FileDown className="w-3 h-3" /> Export to Kepler
                                </button>
                            </div>

                            <div className="glass-card p-5 rounded-2xl flex flex-col hover:border-amber-200 transition-colors">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-amber-100 rounded-md text-amber-700">
                                            <UserX className="w-4 h-4" />
                                        </div>
                                        <span className="text-sm font-bold text-slate-700">Driver Not Found</span>
                                    </div>
                                    <span className="text-2xl font-bold text-amber-600">{statusCounts.driverNotFound.toLocaleString()}</span>
                                </div>
                                <button
                                    onClick={() => handleDownloadStatus('DRIVER_NOT_FOUND', 'driver_not_found_rides')}
                                    className="mt-auto w-full py-2 px-3 bg-slate-50 hover:bg-amber-50 text-slate-600 hover:text-amber-700 text-xs font-bold rounded-lg border border-slate-200 hover:border-amber-200 flex items-center justify-center gap-2 transition-all"
                                >
                                    <FileDown className="w-3 h-3" /> Export to Kepler
                                </button>
                            </div>
                        </div>

                        {/* Data Health & Debug Info */}
                        {debugStats && (
                            <div className="glass-card p-5 rounded-2xl border-l-4 border-l-blue-500">
                                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <Activity className="w-5 h-5 text-blue-600" />
                                    Data Health Check
                                </h3>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div className="bg-slate-50 p-3 rounded-lg">
                                        <p className="text-slate-500">Total Rows</p>
                                        <p className="text-xl font-bold text-slate-800">{debugStats.totalRows}</p>
                                    </div>
                                    <div className="bg-red-50 p-3 rounded-lg">
                                        <p className="text-red-600 font-medium">Dropped (Coords)</p>
                                        <p className="text-xl font-bold text-red-700">{debugStats.droppedInvalidCoord}</p>
                                    </div>
                                    <div className="bg-orange-50 p-3 rounded-lg">
                                        <p className="text-orange-600 font-medium">Dropped (Time)</p>
                                        <p className="text-xl font-bold text-orange-700">{debugStats.droppedTimeRange}</p>
                                    </div>
                                    <div className="bg-yellow-50 p-3 rounded-lg">
                                        <p className="text-yellow-600 font-medium">Dropped (Date)</p>
                                        <p className="text-xl font-bold text-yellow-700">{debugStats.droppedDate}</p>
                                    </div>
                                </div>
                                <div className="mt-4">
                                    <p className="text-xs font-bold text-slate-500 uppercase mb-2">Unique Statuses Found:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {debugStats.uniqueStatuses.map((s, i) => (
                                            <span key={i} className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded border border-slate-200">
                                                {s || '(Empty)'}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Pickup vs Drop Point Exports */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="glass-card p-5 rounded-2xl flex flex-col">
                                <h4 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-indigo-500" /> Pickup Points
                                </h4>
                                <p className="text-xs text-slate-500 mb-4">
                                    Export raw pickup coordinates for mapping tools like Kepler.
                                </p>
                                <button
                                    onClick={() => handleDownloadPickupDrop('PICKUP')}
                                    className="mt-auto w-full py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all"
                                >
                                    <FileDown className="w-3 h-3" /> Export CSV
                                </button>
                            </div>

                            <div className="glass-card p-5 rounded-2xl flex flex-col">
                                <h4 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-pink-500" /> Drop Points
                                </h4>
                                <p className="text-xs text-slate-500 mb-4">
                                    Export raw drop coordinates for drop-off hotspot analysis.
                                </p>
                                <button
                                    onClick={() => handleDownloadPickupDrop('DROP')}
                                    className="mt-auto w-full py-2 px-3 bg-pink-50 hover:bg-pink-100 text-pink-700 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all"
                                >
                                    <FileDown className="w-3 h-3" /> Export CSV
                                </button>
                            </div>

                            <div className="glass-card p-5 rounded-2xl flex flex-col">
                                <h4 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-emerald-500" /> Raw Data + Hex
                                </h4>
                                <p className="text-xs text-slate-500 mb-4">
                                    Export all raw data with Drop Hex ID and Yard-to-Drop distance (km).
                                </p>
                                <button
                                    onClick={handleDownloadRawDataWithHex}
                                    className="mt-auto w-full py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all"
                                >
                                    <FileDown className="w-3 h-3" /> Export CSV
                                </button>
                            </div>
                        </div>

                        {/* Data Table with Sorting */}
                        <div className="glass-panel rounded-2xl overflow-hidden shadow-lg border-0">
                            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                    <LayoutDashboard className="w-4 h-4 text-slate-500" />
                                    Detailed Cluster Data ({timeView})
                                </h3>
                                <div className="text-xs font-medium px-2 py-1 bg-slate-200 rounded-md text-slate-600">
                                    {displayClusters.length} Clusters
                                </div>
                            </div>
                            <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
                                <table className="w-full text-sm text-left text-slate-500">
                                    <thead className="text-xs text-slate-700 uppercase bg-slate-50/80 backdrop-blur sticky top-0 z-10">
                                        <tr>
                                            <th
                                                className="px-6 py-3 cursor-pointer hover:bg-slate-100 transition-colors"
                                                onClick={() => {
                                                    setSortField('hexId');
                                                    setSortDirection(sortField === 'hexId' && sortDirection === 'asc' ? 'desc' : 'asc');
                                                }}
                                            >
                                                <div className="flex items-center gap-1">
                                                    Hex ID {sortField === 'hexId' && (sortDirection === 'asc' ? <ArrowRight className="w-3 h-3 rotate-90" /> : <ArrowRight className="w-3 h-3 -rotate-90" />)}
                                                </div>
                                            </th>
                                            <th
                                                className="px-6 py-3 cursor-pointer hover:bg-slate-100 transition-colors"
                                                onClick={() => {
                                                    setSortField('demand');
                                                    setSortDirection(sortField === 'demand' && sortDirection === 'desc' ? 'asc' : 'desc');
                                                }}
                                            >
                                                <div className="flex items-center gap-1">
                                                    Demand {sortField === 'demand' && (sortDirection === 'desc' ? <ArrowRight className="w-3 h-3 rotate-90" /> : <ArrowRight className="w-3 h-3 -rotate-90" />)}
                                                </div>
                                            </th>
                                            <th
                                                className="px-6 py-3 cursor-pointer hover:bg-slate-100 transition-colors"
                                                onClick={() => {
                                                    setSortField('demandScore');
                                                    setSortDirection(sortField === 'demandScore' && sortDirection === 'desc' ? 'asc' : 'desc');
                                                }}
                                            >
                                                <div className="flex items-center gap-1">
                                                    Score {sortField === 'demandScore' && (sortDirection === 'desc' ? <ArrowRight className="w-3 h-3 rotate-90" /> : <ArrowRight className="w-3 h-3 -rotate-90" />)}
                                                </div>
                                            </th>
                                            <th className="px-6 py-3">Ideal Supply</th>
                                            <th
                                                className="px-6 py-3 cursor-pointer hover:bg-slate-100 transition-colors"
                                                onClick={() => {
                                                    setSortField('allocatedSupply');
                                                    setSortDirection(sortField === 'allocatedSupply' && sortDirection === 'desc' ? 'asc' : 'desc');
                                                }}
                                            >
                                                <div className="flex items-center gap-1">
                                                    Allocated {sortField === 'allocatedSupply' && (sortDirection === 'desc' ? <ArrowRight className="w-3 h-3 rotate-90" /> : <ArrowRight className="w-3 h-3 -rotate-90" />)}
                                                </div>
                                            </th>
                                            <th
                                                className="px-6 py-3 cursor-pointer hover:bg-slate-100 transition-colors"
                                                onClick={() => {
                                                    setSortField('slaComplianceScore');
                                                    setSortDirection(sortField === 'slaComplianceScore' && sortDirection === 'desc' ? 'asc' : 'desc');
                                                }}
                                            >
                                                <div className="flex items-center gap-1">
                                                    SLA {sortField === 'slaComplianceScore' && (sortDirection === 'desc' ? <ArrowRight className="w-3 h-3 rotate-90" /> : <ArrowRight className="w-3 h-3 -rotate-90" />)}
                                                </div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {displayClusters.map((c) => (
                                            <tr key={c.hexId} className="bg-white hover:bg-slate-50 transition-colors group">
                                                <td className="px-6 py-4 font-mono text-xs text-slate-400 group-hover:text-indigo-600 transition-colors">{c.hexId}</td>
                                                <td className="px-6 py-4 font-bold text-slate-700">{c.demand}</td>
                                                <td className="px-6 py-4 text-slate-500">{c.demandScore}</td>
                                                <td className="px-6 py-4 text-slate-400">{c.requiredSupply}</td>
                                                <td className={`px-6 py-4 font-bold ${c.allocatedSupply < c.requiredSupply ? 'text-amber-600' : 'text-emerald-600'}`}>
                                                    {c.allocatedSupply}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold text-slate-600 w-8">{c.slaComplianceScore}%</span>
                                                        <div className="flex-1 bg-slate-100 rounded-full h-2 min-w-[60px] overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full transition-all duration-500 ${c.slaComplianceScore >= 90 ? 'bg-emerald-500' :
                                                                    c.slaComplianceScore >= 70 ? 'bg-amber-500' : 'bg-rose-500'
                                                                    }`}
                                                                style={{ width: `${c.slaComplianceScore}%` }}
                                                            ></div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Fleet Allocation Results Section */}
                        <div className="mt-12 border-t border-slate-200 pt-8">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
                                    <LayoutDashboard className="w-6 h-6" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900">Fleet Allocation Results (Fish Bowl Only)</h2>
                                    <p className="text-slate-500">Optimized distribution for the specific Fish Bowl hexes.</p>
                                </div>
                            </div>

                            <div className="glass-card overflow-hidden rounded-2xl">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Hex ID</th>
                                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Demand</th>
                                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Ideal Supply</th>
                                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Allocated</th>
                                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">SLA Score</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {optimizedClusters.map((cluster) => (
                                                <tr key={cluster.hexId} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="p-4 text-sm font-medium text-slate-700 font-mono">{cluster.hexId}</td>
                                                    <td className="p-4 text-sm text-slate-600 text-right">{cluster.demand}</td>
                                                    <td className="p-4 text-sm text-slate-600 text-right">{cluster.requiredSupply}</td>
                                                    <td className="p-4 text-sm font-bold text-indigo-600 text-right">{cluster.allocatedSupply}</td>
                                                    <td className="p-4 text-sm text-right">
                                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${cluster.slaComplianceScore >= 80 ? 'bg-green-100 text-green-700' :
                                                            cluster.slaComplianceScore >= 50 ? 'bg-amber-100 text-amber-700' :
                                                                'bg-red-100 text-red-700'
                                                            }`}>
                                                            {cluster.slaComplianceScore}%
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                            {optimizedClusters.length === 0 && (
                                                <tr>
                                                    <td colSpan={5} className="p-8 text-center text-slate-400">
                                                        No data available for Fish Bowl hexes.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default HexHotspots;
