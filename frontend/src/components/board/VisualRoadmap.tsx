import React from 'react';

export interface MilestoneItem {
  id: string;
  title: string;
  dueDate: string;
  status: 'pending' | 'in_progress' | 'achieved';
}

export interface SprintItem {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'planned' | 'active' | 'completed';
  completedPoints: number;
  totalPoints: number;
}

interface VisualRoadmapProps {
  sprints: SprintItem[];
  milestones: MilestoneItem[];
}

export const VisualRoadmap: React.FC<VisualRoadmapProps> = ({
  sprints,
  milestones,
}) => {
  return (
    <div className="flex flex-col space-y-6 bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm border border-gray-200 dark:border-gray-700">
      <h3 className="text-base font-bold text-gray-800 dark:text-white">
        Society Milestones & Sprint Roadmap
      </h3>

      {/* Sprints Section */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Time-Boxed Sprints
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sprints.map((sprint) => {
            const progress =
              sprint.totalPoints > 0
                ? Math.round((sprint.completedPoints / sprint.totalPoints) * 100)
                : 0;

            const statusColors = {
              planned: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
              active: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
              completed: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
            };

            return (
              <div
                key={sprint.id}
                className="p-4 rounded-md border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex flex-col justify-between"
              >
                <div className="flex justify-between items-start mb-2">
                  <h5 className="font-semibold text-sm text-gray-800 dark:text-white">
                    {sprint.name}
                  </h5>
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${statusColors[sprint.status]}`}
                  >
                    {sprint.status}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mb-3">
                  {new Date(sprint.startDate).toLocaleDateString()} -{' '}
                  {new Date(sprint.endDate).toLocaleDateString()}
                </div>

                {/* Progress Bar */}
                <div className="w-full">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Progress</span>
                    <span>
                      {sprint.completedPoints}/{sprint.totalPoints} pts ({progress}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Milestones Timeline */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Target Milestones
        </h4>
        <div className="relative border-l-2 border-blue-500 ml-3 space-y-4 py-1">
          {milestones.map((m) => (
            <div key={m.id} className="mb-4 ml-4">
              <div className="absolute -left-[9px] w-4 h-4 rounded-full bg-blue-500 border-2 border-white dark:border-gray-800" />
              <div className="flex justify-between items-start">
                <div>
                  <h5 className="text-sm font-semibold text-gray-800 dark:text-white">
                    {m.title}
                  </h5>
                  <span className="text-xs text-gray-500">
                    Due: {new Date(m.dueDate).toLocaleDateString()}
                  </span>
                </div>
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded capitalize ${
                    m.status === 'achieved'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/40'
                      : m.status === 'in_progress'
                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-700'
                  }`}
                >
                  {m.status.replace('_', ' ')}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
