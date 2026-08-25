import AgricultureIcon from '@mui/icons-material/Agriculture';
import { Card, Icon } from '../../../components/ui';

type Props = {
  userName: string;
  onNewOrder: () => void;
  onOrders: () => void;
};

/** Encabezado del Dashboard con saludo y acciones comerciales principales. */
export const DashboardHero = ({ userName, onNewOrder, onOrders }: Props) => (
  <Card className="relative overflow-hidden border-0 bg-gradient-to-r from-primary to-primary-container p-8">
    <div className="absolute right-[-100px] top-[-50px] h-[400px] w-[400px] rounded-full bg-white/10" />
    <span
      className="material-symbols-outlined absolute -right-4 -top-4 select-none text-[140px] text-white/10"
      style={{ fontVariationSettings: "'FILL' 1" }}
    >
      eco
    </span>
    <div className="relative">
      <div className="mb-2 flex items-center gap-2">
        <AgricultureIcon sx={{ color: 'white', fontSize: 20 }} />
        <p className="text-xs font-bold uppercase tracking-widest text-white/60">
          Plataforma Agro_Sales
        </p>
      </div>
      <h1 className="mb-2 text-2xl font-extrabold leading-tight text-white md:text-3xl">
        Bienvenido, {userName}
      </h1>
      <p className="mb-5 max-w-lg text-sm text-white/75">
        Tu herramienta de gestión agrícola. Resumen general de las operaciones de hoy.
      </p>
      
    </div>
  </Card>
);
