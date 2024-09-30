import React, { useState } from 'react';

interface TabProps {
  labels: string[];
  children: React.ReactNode[];
}

const Tabs: React.FC<TabProps> = ({ labels, children }) => {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div>
      <div className="flex justify-center space-x-4">
        {labels.map((label, index) => (
          <button
            key={index}
            className={`px-4 py-2 ${activeTab === index ? 'border-b-2 border-blue-500' : ''}`}
            onClick={() => setActiveTab(index)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mt-4">
        {children[activeTab]}
      </div>
    </div>
  );
};

export default Tabs;
