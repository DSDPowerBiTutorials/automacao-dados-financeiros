'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, MoreHorizontal, GripVertical } from 'lucide-react';
import { useState } from 'react';
import { TaskCard } from './TaskCard';
import type { WSSection, WSTask } from '@/lib/workstream-types';
import type { WSUser } from '@/lib/workstream-types';

interface BoardColumnProps {
    section: WSSection;
    tasks: WSTask[];
    onTaskClick: (task: WSTask) => void;
    onAddTask: (sectionId: number, title: string) => void;
    onDeleteSection: (sectionId: number) => void;
    onRenameSection: (sectionId: number, title: string) => void;
    users?: WSUser[];
}

export function BoardColumn({
    section,
    tasks,
    onTaskClick,
    onAddTask,
    onDeleteSection,
    onRenameSection,
    users = [],
}: BoardColumnProps) {
    const [isAddingTask, setIsAddingTask] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editTitle, setEditTitle] = useState(section.title);
    const [showMenu, setShowMenu] = useState(false);

    const {
        attributes,
        listeners,
        setNodeRef: setSortableRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: `section-${section.id}`,
        data: { type: 'section', section },
    });

    const { setNodeRef: setDroppableRef, isOver } = useDroppable({
        id: `section-drop-${section.id}`,
        data: { type: 'section', sectionId: section.id },
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    const taskIds = tasks.map((t) => `task-${t.id}`);

    function handleAddTask() {
        if (newTaskTitle.trim()) {
            onAddTask(section.id, newTaskTitle.trim());
            setNewTaskTitle('');
            setIsAddingTask(false);
        }
    }

    function handleRenameSubmit() {
        if (editTitle.trim() && editTitle !== section.title) {
            onRenameSection(section.id, editTitle.trim());
        }
        setIsEditingTitle(false);
    }

    return (
        <div
            ref={setSortableRef}
            style={style}
            className={`flex-shrink-0 w-[300px] flex flex-col bg-gray-50 dark:bg-[#0a0a0a] rounded-xl border border-gray-200 dark:border-gray-800 max-h-full ${isDragging ? 'ring-1 ring-blue-500/50' : ''
                }`}
        >
            {/* Column Header */}
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-200 dark:border-gray-800">
                {/* Drag handle */}
                <div
                    {...attributes}
                    {...listeners}
                    className="cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-white/10"
                >
                    <GripVertical className="h-3.5 w-3.5 text-gray-600" />
                </div>

                {/* Title */}
                {isEditingTitle ? (
                    <input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onBlur={handleRenameSubmit}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameSubmit();
                            if (e.key === 'Escape') {
                                setEditTitle(section.title);
                                setIsEditingTitle(false);
                            }
                        }}
                        className="flex-1 bg-transparent border-none text-gray-900 dark:text-white text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1"
                        autoFocus
                    />
                ) : (
                    <h3
                        className="flex-1 text-sm font-semibold text-gray-700 dark:text-gray-300 truncate cursor-pointer hover:text-gray-900 dark:text-white"
                        onDoubleClick={() => {
                            setEditTitle(section.title);
                            setIsEditingTitle(true);
                        }}
                    >
                        {section.title}
                    </h3>
                )}

                {/* Task count */}
                <span className="text-xs text-gray-500 bg-gray-100 dark:bg-black px-1.5 py-0.5 rounded">
                    {tasks.length}
                </span>

                {/* Menu */}
                <div className="relative">
                    <button
                        onClick={() => setShowMenu(!showMenu)}
                        className="p-1 rounded hover:bg-white/10 text-gray-500 hover:text-gray-700 dark:text-gray-300 transition-colors"
                    >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                    {showMenu && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                            <div className="absolute right-0 top-full mt-1 z-20 bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-1 min-w-[140px]">
                                <button
                                    className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-white/10"
                                    onClick={() => {
                                        setEditTitle(section.title);
                                        setIsEditingTitle(true);
                                        setShowMenu(false);
                                    }}
                                >
                                    Rename
                                </button>
                                <button
                                    className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-red-900/20"
                                    onClick={() => {
                                        onDeleteSection(section.id);
                                        setShowMenu(false);
                                    }}
                                >
                                    Delete
                                </button>
                            </div>
                        </>
                    )}
                </div>

                {/* Add task */}
                <button
                    onClick={() => setIsAddingTask(true)}
                    className="p-1 rounded hover:bg-white/10 text-gray-500 hover:text-gray-700 dark:text-gray-300 transition-colors"
                >
                    <Plus className="h-3.5 w-3.5" />
                </button>
            </div>

            {/* Task list (droppable) */}
            <div ref={setDroppableRef} className="flex-1 overflow-y-auto px-2 py-2">
                <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
                    <div className={`space-y-2 min-h-[40px] ${isOver ? 'bg-blue-500/5 rounded-lg' : ''}`}>
                        {tasks.map((task) => (
                            <TaskCard key={task.id} task={task} onClick={onTaskClick} users={users} />
                        ))}
                    </div>
                </SortableContext>

                {/* Add task inline */}
                {isAddingTask && (
                    <div className="mt-2">
                        <textarea
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            placeholder="Task title..."
                            className="w-full bg-white dark:bg-black border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
                            rows={2}
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleAddTask();
                                }
                                if (e.key === 'Escape') {
                                    setNewTaskTitle('');
                                    setIsAddingTask(false);
                                }
                            }}
                        />
                        <div className="flex gap-2 mt-1.5">
                            <button
                                onClick={handleAddTask}
                                disabled={!newTaskTitle.trim()}
                                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-md font-medium disabled:opacity-50 transition-colors"
                            >
                                Add
                            </button>
                            <button
                                onClick={() => {
                                    setNewTaskTitle('');
                                    setIsAddingTask(false);
                                }}
                                className="px-3 py-1 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-white text-xs rounded-md hover:bg-white/10 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Add task button at bottom */}
            {!isAddingTask && (
                <button
                    onClick={() => setIsAddingTask(true)}
                    className="flex items-center gap-1.5 mx-2 mb-2 px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:text-gray-700 dark:text-gray-300 hover:bg-white/5 transition-colors"
                >
                    <Plus className="h-3.5 w-3.5" />
                    Add task
                </button>
            )}
        </div>
    );
}
