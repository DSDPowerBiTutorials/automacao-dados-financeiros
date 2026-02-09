'use client';

import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { BoardColumn } from './BoardColumn';
import { TaskCard } from './TaskCard';
import type { WSSection, WSTask, WSUser } from '@/lib/workstream-types';

interface BoardViewProps {
  sections: WSSection[];
  tasks: WSTask[];
  sectionOrder: number[];
  onTaskClick: (task: WSTask) => void;
  onAddTask: (sectionId: number, title: string) => void;
  onMoveTask: (taskId: number, fromSectionId: number, toSectionId: number, newIndex: number) => void;
  onReorderSections: (newOrder: number[]) => void;
  onDeleteSection: (sectionId: number) => void;
  onRenameSection: (sectionId: number, title: string) => void;
  onAddSection: (title: string) => void;
  users?: WSUser[];
}

export function BoardView({
  sections,
  tasks,
  sectionOrder,
  onTaskClick,
  onAddTask,
  onMoveTask,
  onReorderSections,
  onDeleteSection,
  onRenameSection,
  onAddSection,
  users = [],
}: BoardViewProps) {
  const [activeTask, setActiveTask] = useState<WSTask | null>(null);
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  // Build ordered section list
  const orderedSections = sectionOrder
    .map((id) => sections.find((s) => s.id === id))
    .filter(Boolean) as WSSection[];

  // Add any sections not in order
  const missingOrder = sections.filter(
    (s) => !sectionOrder.includes(s.id)
  );
  const allOrderedSections = [...orderedSections, ...missingOrder];

  function getTasksForSection(sectionId: number) {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return [];
    const sectionTasks = tasks.filter((t) => t.section_id === sectionId);
    // Order by task_order array
    if (section.task_order?.length) {
      const ordered: WSTask[] = [];
      for (const tid of section.task_order) {
        const found = sectionTasks.find((t) => t.id === tid);
        if (found) ordered.push(found);
      }
      // Add any tasks not in order
      const remaining = sectionTasks.filter((t) => !section.task_order.includes(t.id));
      return [...ordered, ...remaining];
    }
    return sectionTasks.sort((a, b) => a.position - b.position);
  }

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    if (String(active.id).startsWith('task-')) {
      const taskId = parseInt(String(active.id).replace('task-', ''));
      const task = tasks.find((t) => t.id === taskId);
      if (task) setActiveTask(task);
    }
  }

  function handleDragOver(event: DragOverEvent) {
    // Could implement live preview here
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Task reorder
    if (activeId.startsWith('task-') && overId.startsWith('task-')) {
      const activeTaskId = parseInt(activeId.replace('task-', ''));
      const overTaskId = parseInt(overId.replace('task-', ''));
      const activeTaskObj = tasks.find((t) => t.id === activeTaskId);
      const overTaskObj = tasks.find((t) => t.id === overTaskId);
      if (!activeTaskObj || !overTaskObj) return;

      const overSection = sections.find((s) => s.id === overTaskObj.section_id);
      if (!overSection) return;

      const overTasks = getTasksForSection(overSection.id);
      const overIndex = overTasks.findIndex((t) => t.id === overTaskId);

      onMoveTask(activeTaskId, activeTaskObj.section_id, overSection.id, overIndex);
    }

    // Task dropped on empty section
    if (activeId.startsWith('task-') && overId.startsWith('section-drop-')) {
      const taskId = parseInt(activeId.replace('task-', ''));
      const sectionId = parseInt(overId.replace('section-drop-', ''));
      const taskObj = tasks.find((t) => t.id === taskId);
      if (!taskObj) return;
      onMoveTask(taskId, taskObj.section_id, sectionId, 0);
    }

    // Section reorder
    if (activeId.startsWith('section-') && overId.startsWith('section-')) {
      const activeSectionId = parseInt(activeId.replace('section-', ''));
      const overSectionId = parseInt(overId.replace('section-', ''));
      if (activeSectionId === overSectionId) return;

      const oldIndex = sectionOrder.indexOf(activeSectionId);
      const newIndex = sectionOrder.indexOf(overSectionId);
      if (oldIndex === -1 || newIndex === -1) return;

      const newOrder = [...sectionOrder];
      newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, activeSectionId);
      onReorderSections(newOrder);
    }
  }

  function handleAddSection() {
    if (newSectionTitle.trim()) {
      onAddSection(newSectionTitle.trim());
      setNewSectionTitle('');
      setIsAddingSection(false);
    }
  }

  const sectionIds = allOrderedSections.map((s) => `section-${s.id}`);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 h-full overflow-x-auto px-4 py-4 items-start">
        <SortableContext items={sectionIds} strategy={horizontalListSortingStrategy}>
          {allOrderedSections.map((section) => (
            <BoardColumn
              key={section.id}
              section={section}
              tasks={getTasksForSection(section.id)}
              onTaskClick={onTaskClick}
              onAddTask={onAddTask}
              onDeleteSection={onDeleteSection}
              onRenameSection={onRenameSection}
              users={users}
            />
          ))}
        </SortableContext>

        {/* Add column */}
        {isAddingSection ? (
          <div className="flex-shrink-0 w-[300px] bg-[#252628] rounded-xl border border-gray-800 p-3">
            <input
              value={newSectionTitle}
              onChange={(e) => setNewSectionTitle(e.target.value)}
              placeholder="Section name..."
              className="w-full bg-[#1e1f21] border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddSection();
                if (e.key === 'Escape') {
                  setNewSectionTitle('');
                  setIsAddingSection(false);
                }
              }}
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleAddSection}
                disabled={!newSectionTitle.trim()}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-md font-medium disabled:opacity-50"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setNewSectionTitle('');
                  setIsAddingSection(false);
                }}
                className="px-3 py-1 text-gray-400 hover:text-white text-xs rounded-md hover:bg-white/10"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsAddingSection(true)}
            className="flex-shrink-0 w-[300px] flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-gray-700 hover:border-gray-600 text-gray-500 hover:text-gray-400 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span className="text-sm">Add Section</span>
          </button>
        )}
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeTask ? <TaskCard task={activeTask} onClick={() => { }} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
