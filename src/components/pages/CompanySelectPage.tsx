import React from 'react';
import { Icon } from '../ui';

const COMPANIES = [
  'AGROFORTRESS, S.A.',
  'FORAGRO VETERINARIA, SOCIEDAD ANÓNIMA.',
  'XXXXXXXX',
  'NEGOCIOS RELACIONADOS, S.A.',
];

interface CompanySelectPageProps { onSelect: (company: string) => void; }

const CompanySelectPage: React.FC<CompanySelectPageProps> = ({ onSelect }) => (
  <div className="min-h-screen bg-white p-5">
    <h1 className="text-lg font-semibold text-on-surface mb-6">Favor seleccione la empresa</h1>
    <div className="space-y-1">
      {COMPANIES.map(company => (
        <button
          key={company}
          onClick={() => onSelect(company)}
          className="w-full flex items-center gap-4 px-2 py-4 hover:bg-primary/5 rounded-xl transition-colors text-left border-b border-outline-variant/20 last:border-0"
        >
          <Icon name="business" size={22} className="text-primary flex-shrink-0" fill />
          <span className="text-sm text-on-surface">{company}</span>
        </button>
      ))}
    </div>
  </div>
);

export default CompanySelectPage;
