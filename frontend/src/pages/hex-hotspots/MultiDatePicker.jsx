import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, Calendar as CalendarIcon, Check } from 'lucide-react';

interface MultiDatePickerProps {
    selectedDates: string[];
    onDateChange: (dates: string[]) => void;
}

export const MultiDatePicker: React.FC<MultiDatePickerProps> = ({ selectedDates, onDateChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    // Use the first selected date as the view reference, or today
    const initialDate = selectedDates.length > 0 ? new Date(selectedDates[0]) : new Date();
    const [currentMonth, setCurrentMonth] = useState(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));

    // Close on click outside (simplified handling for now)
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (isOpen && !(e.target as Element).closest('.date-picker-container')) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const daysInMonth = (date: Date) => {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    };

    const firstDayOfMonth = (date: Date) => {
        return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    };

    const formatDate = (date: Date) => {
        const y = date.getFullYear();
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const d = date.getDate().toString().padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const toggleDate = (date: Date) => {
        const dateStr = formatDate(date);
        let newSelection = [...selectedDates];
        if (newSelection.includes(dateStr)) {
            newSelection = newSelection.filter(d => d !== dateStr);
        } else {
            newSelection.push(dateStr);
        }
        onDateChange(newSelection);
    };

    const nextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    };

    const prevMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    };

    const renderCalendar = () => {
        const days = daysInMonth(currentMonth);
        const startDay = firstDayOfMonth(currentMonth);
        const calendar = [];

        // Empty slots for days before start of month
        for (let i = 0; i < startDay; i++) {
            calendar.push(<div key={`empty-${i}`} className="h-8 w-8" />);
        }

        // Days
        for (let i = 1; i <= days; i++) {
            const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i);
            const dateStr = formatDate(date);
            const isSelected = selectedDates.includes(dateStr);

            calendar.push(
                <button
                    key={dateStr}
                    onClick={() => toggleDate(date)}
                    className={`h-8 w-8 rounded-full text-sm font-medium transition-all duration-200 flex items-center justify-center
                        ${isSelected
                            ? 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-200 transform scale-105'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                >
                    {i}
                </button>
            );
        }

        return calendar;
    };

    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    return (
        <div className="relative date-picker-container z-50">
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-4 py-2 bg-white rounded-xl border transition-all duration-200 group
                    ${isOpen || selectedDates.length > 0 ? 'border-indigo-200 shadow-sm ring-2 ring-indigo-50' : 'border-slate-200 hover:border-slate-300'}`}
            >
                <div className={`p-1 rounded-lg ${selectedDates.length > 0 ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                    <CalendarIcon className="w-4 h-4" />
                </div>
                <span className={`text-sm font-medium ${selectedDates.length > 0 ? 'text-slate-800' : 'text-slate-500'}`}>
                    {selectedDates.length === 0
                        ? 'Select Dates'
                        : selectedDates.length === 1
                            ? new Date(selectedDates[0]).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                            : `${selectedDates.length} Days Selected`}
                </span>
                {selectedDates.length > 0 && (
                    <div
                        onClick={(e) => {
                            e.stopPropagation();
                            onDateChange([]);
                        }}
                        className="ml-1 p-0.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-red-500 transition-colors"
                    >
                        <X className="w-3 h-3" />
                    </div>
                )}
            </button>

            {/* Dropdown Panel */}
            {isOpen && (
                <div className="absolute top-full mt-2 left-0 w-72 bg-white/90 backdrop-blur-xl border border-white/20 shadow-xl rounded-2xl p-4 animate-fade-in z-50">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                        <button onClick={prevMonth} className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-sm font-bold text-slate-800">
                            {months[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                        </span>
                        <button onClick={nextMonth} className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Weekday Labels */}
                    <div className="grid grid-cols-7 mb-2">
                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                            <div key={day} className="text-center text-xs font-semibold text-slate-400 py-1">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Calendar Grid */}
                    <div className="grid grid-cols-7 gap-y-1 justify-items-center">
                        {renderCalendar()}
                    </div>

                    {/* Footer */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center">
                        <span className="text-xs text-slate-400 font-medium">
                            {selectedDates.length} selected
                        </span>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="px-3 py-1 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-lg hover:bg-indigo-100 transition-colors"
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
