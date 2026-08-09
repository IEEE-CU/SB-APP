import React from "react";

export interface PollOption {
  text: string;
  votes: string[]; // User IDs or objects
}

export interface PollData {
  question: string;
  options: PollOption[];
}

interface PollCardProps {
  messageId: string;
  poll: PollData;
  currentUserId?: string;
  onVote: (messageId: string, optionIndex: number) => void;
}

export const PollCard: React.FC<PollCardProps> = ({
  messageId,
  poll,
  currentUserId,
  onVote,
}) => {
  if (!poll || !poll.question || !poll.options) return null;

  const totalVotes = poll.options.reduce(
    (acc, opt) => acc + (opt.votes ? opt.votes.length : 0),
    0
  );

  return (
    <div className="my-2 p-4 bg-gray-50 dark:bg-gray-800/80 rounded-lg border border-gray-200 dark:border-gray-700 max-w-md">
      <h4 className="font-semibold text-sm text-gray-800 dark:text-white mb-3">
        📊 {poll.question}
      </h4>
      <div className="space-y-2">
        {poll.options.map((option, idx) => {
          const voteCount = option.votes ? option.votes.length : 0;
          const percentage =
            totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
          const hasVoted =
            currentUserId &&
            option.votes &&
            option.votes.some(
              (v: any) => (v.id || v._id || v).toString() === currentUserId
            );

          return (
            <button
              key={idx}
              onClick={() => onVote(messageId, idx)}
              className={`w-full text-left p-2.5 rounded-md border text-xs transition relative overflow-hidden flex items-center justify-between ${
                hasVoted
                  ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/30 font-semibold"
                  : "border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/50"
              }`}
            >
              {/* Progress Background Fill */}
              <div
                className="absolute left-0 top-0 bottom-0 bg-blue-200/40 dark:bg-blue-800/30 transition-all duration-300 pointer-events-none"
                style={{ width: `${percentage}%` }}
              />
              <span className="relative z-10 text-gray-800 dark:text-gray-200">
                {option.text}
              </span>
              <span className="relative z-10 text-gray-500 font-mono text-[11px]">
                {voteCount} ({percentage}%)
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-2 text-[11px] text-gray-400 text-right">
        {totalVotes} total {totalVotes === 1 ? "vote" : "votes"}
      </div>
    </div>
  );
};
