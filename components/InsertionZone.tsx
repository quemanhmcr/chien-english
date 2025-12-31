import React from 'react';
import { Plus } from 'lucide-react';

interface InsertionZoneProps {
    index: number;
    onInsert: () => void;
}

export const InsertionZone: React.FC<InsertionZoneProps> = ({ index, onInsert }) => {
    return (
        <div className="group relative flex items-center justify-center py-3 -my-1.5">
            {/* Invisible trigger area - always present for hover detection */}
            <div className="absolute inset-x-0 h-10 cursor-pointer" />

            {/* Visible line - M3 soft gradient appearance on hover */}
            <div
                className="absolute inset-x-6 top-1/2 -translate-y-1/2 h-[3px] rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200"
                style={{
                    background: 'linear-gradient(90deg, transparent 0%, var(--md-sys-color-primary-container) 20%, var(--md-sys-color-primary) 50%, var(--md-sys-color-primary-container) 80%, transparent 100%)'
                }}
            />

            {/* Plus button - M3 FAB-style with elevation on hover */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onInsert();
                }}
                className="relative z-10 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 hover:scale-110 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{
                    backgroundColor: 'var(--md-sys-color-primary)',
                    color: 'var(--md-sys-color-on-primary)',
                    boxShadow: '0 2px 8px rgba(91, 88, 145, 0.25), 0 1px 3px rgba(0,0,0,0.1)'
                }}
                title={`Chèn câu hỏi mới tại vị trí ${index + 1}`}
            >
                <Plus className="w-5 h-5" strokeWidth={2.5} />
            </button>

            {/* Subtle pulse animation hint on hover */}
            <div
                className="absolute w-9 h-9 rounded-full opacity-0 group-hover:opacity-100 group-hover:animate-ping pointer-events-none"
                style={{
                    backgroundColor: 'var(--md-sys-color-primary)',
                    animationDuration: '1.5s',
                    animationIterationCount: '1'
                }}
            />
        </div>
    );
};
