interface FlowTabsProps {
  tabs: { id: string; title: string }[];
  activeId: string;
  onSelect: (id: string) => void;
}

export function FlowTabs({ tabs, activeId, onSelect }: FlowTabsProps) {
  return (
    <nav className="flow-tabs">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`flow-tabs__tab ${tab.id === activeId ? 'flow-tabs__tab--active' : ''}`}
          onClick={() => onSelect(tab.id)}
        >
          {tab.title}
        </button>
      ))}
    </nav>
  );
}
