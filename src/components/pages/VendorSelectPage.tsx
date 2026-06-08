import React, { useState } from 'react';
import { Icon } from '../ui';

const VENDORS = [
  'ANDREA DE CEBERG',
  'AJAX FONSECA',
  'BYRON CHACÓN',
  'JOSE ALFARO',
  'OSMAN GODOY',
  'PEDRO GÓMEZ BOC',
  'EDUARDO CÓRDOVA',
];

interface VendorSelectPageProps { onSelect: (vendor: string) => void; }

const VendorSelectPage: React.FC<VendorSelectPageProps> = ({ onSelect }) => {
  const [selected, setSelected] = useState('BYRON CHACÓN');

  return (
    <div className="min-h-screen bg-white p-5">
      <h1 className="text-lg font-semibold text-on-surface mb-6">Favor seleccione vendedor</h1>
      <div className="space-y-1">
        {VENDORS.map(vendor => {
          const isSelected = vendor === selected;
          return (
            <button
              key={vendor}
              onClick={() => setSelected(vendor)}
              className={`w-full flex items-center gap-4 px-2 py-4 rounded-xl transition-colors text-left ${isSelected ? 'bg-primary/8' : 'hover:bg-surface-container'}`}
            >
              <Icon name="person" size={20} className="text-primary flex-shrink-0" fill />
              <span className={`text-sm ${isSelected ? 'text-on-surface font-medium' : 'text-on-surface'}`}>{vendor}</span>
            </button>
          );
        })}
      </div>

      {/* FAB next */}
      <button
        onClick={() => onSelect(selected)}
        className="fixed bottom-8 right-6 w-14 h-14 bg-primary text-white rounded-2xl shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
      >
        <Icon name="arrow_forward" size={22} />
      </button>
    </div>
  );
};

export default VendorSelectPage;
