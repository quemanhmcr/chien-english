import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Edit3, Trash2, TrendingUp } from 'lucide-react';
import { Exercise } from '../types';

interface SortableExerciseItemProps {
    exercise: Exercise;
    index: number;
    onEdit: () => void;
    onDelete: () => void;
    onInlineEdit?: () => void;
    isInlineEditing?: boolean;
    inlineValue?: string;
    onInlineChange?: (value: string) => void;
    onInlineSave?: () => void;
}

export const SortableExerciseItem: React.FC<SortableExerciseItemProps> = ({
    exercise,
    index,
    onEdit,
    onDelete,
    onInlineEdit,
    isInlineEditing,
    inlineValue,
    onInlineChange,
    onInlineSave
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: exercise.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 100 : undefined,
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && onInlineSave) {
            e.preventDefault();
            onInlineSave();
        }
        if (e.key === 'Escape' && onInlineSave) {
            onInlineSave();
        }
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`drag-item group flex items-center gap-4 p-5 rounded-2xl border transition-all duration-200 ${isDragging
                    ? 'is-dragging bg-white border-indigo-500 shadow-xl'
                    : 'bg-[var(--md-sys-color-surface-container-lowest)] border-slate-200/60 hover:border-indigo-400 hover:bg-white'
                }`}
        >
            {/* Drag Handle */}
            <button
                {...attributes}
                {...listeners}
                className="p-2 rounded-lg text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 cursor-grab active:cursor-grabbing transition-all touch-none"
                aria-label="Drag to reorder"
            >
                <GripVertical className="w-5 h-5" />
            </button>

            {/* Index Number */}
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm transition-all duration-300 ${isDragging
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 group-hover:bg-indigo-600 group-hover:text-white'
                }`}>
                {index + 1}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                {isInlineEditing ? (
                    <input
                        type="text"
                        autoFocus
                        value={inlineValue}
                        onChange={(e) => onInlineChange?.(e.target.value)}
                        onBlur={onInlineSave}
                        onKeyDown={handleKeyDown}
                        className="w-full p-2 rounded-lg border-2 border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold text-slate-900"
                    />
                ) : (
                    <p
                        onClick={onInlineEdit}
                        className="font-bold text-slate-900 text-base cursor-text hover:bg-slate-50 rounded-lg px-2 py-1 -mx-2 transition-colors truncate"
                        title="Click để chỉnh sửa"
                    >
                        {exercise.vietnamese}
                    </p>
                )}
                <div className="flex items-center gap-3 mt-1.5">
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${exercise.type === 'translation' ? 'bg-blue-50 border-blue-100 text-blue-600' :
                            exercise.type === 'roleplay' ? 'bg-purple-50 border-purple-100 text-purple-600' :
                                'bg-amber-50 border-amber-100 text-amber-600'
                        }`}>
                        {exercise.type}
                    </span>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${exercise.difficulty === 'Easy' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                            exercise.difficulty === 'Medium' ? 'bg-amber-50 border-amber-100 text-amber-600' :
                                'bg-rose-50 border-rose-100 text-rose-600'
                        }`}>
                        {exercise.difficulty}
                    </span>
                    {exercise.hint && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium italic truncate">
                            <TrendingUp className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{exercise.hint}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                <button
                    onClick={(e) => { e.stopPropagation(); onEdit(); }}
                    className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                    title="Chỉnh sửa chi tiết"
                >
                    <Edit3 className="w-4 h-4" />
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    className="p-2.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                    title="Xóa câu hỏi"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};
