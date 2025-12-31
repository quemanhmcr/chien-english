import React from 'react';
import { Plus } from 'lucide-react';

interface InsertionZoneProps {
    index: number;
    onInsert: () => void;
}

export const InsertionZone: React.FC<InsertionZoneProps> = ({ index, onInsert }) => {
    return (
        <div className="group relative flex items-center justify-center py-2 -my-1">
            {/* Invisible trigger area - always present for hover detection */}
            <div className="absolute inset-x-0 h-6 cursor-pointer" />

            {/* Visible line - appears on hover */}
            <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-[2px] bg-indigo-200 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-150" />

            {/* Plus button - appears on hover */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onInsert();
                }}
                className="relative z-10 w-7 h-7 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-md hover:shadow-lg transition-all opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 hover:scale-110 active:scale-95"
                title={`Chèn câu hỏi mới tại vị trí ${index + 1}`}
            >
                <Plus className="w-4 h-4" />
            </button>
        </div>
    );
};
