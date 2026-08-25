import { Icon } from '../../../components/ui';

export type DashboardQuickAction = {
  icon: string;
  label: string;
  route: string;
};

export const QuickActionsCard = ({
  actions,
  onNavigate,
}: {
  actions: DashboardQuickAction[];
  onNavigate: (route: string) => void;
}) => (
  <div className="grid grid-cols-2 gap-3">
    {actions.map((action) => (
      <button
        key={action.route}
        type="button"
        className="group flex min-w-0 flex-col items-center gap-2 rounded-xl border border-outline-variant bg-white p-4 transition-all hover:border-primary hover:bg-primary/5"
        onClick={() => onNavigate(action.route)}
      >
        <Icon
          name={action.icon}
          size={24}
          className="text-on-surface-variant transition-colors group-hover:text-primary"
        />
        <span className="text-center text-xs font-medium text-on-surface-variant group-hover:text-primary">
          {action.label}
        </span>
      </button>
    ))}
  </div>
);
