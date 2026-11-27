import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { resolverPeriodo, seleccionInicial, type Periodo, type SeleccionPeriodo } from './lib/periodo';

const Contexto = createContext<{
  seleccion: SeleccionPeriodo; periodo: Periodo; cambiar: (s: SeleccionPeriodo) => void;
} | null>(null);

/** Un único filtro de sesión para Inicio, Dashboard, historial y exportaciones. */
export function ProveedorPeriodo({ children }: { children: React.ReactNode }) {
  const [seleccion, cambiar] = useState(seleccionInicial);
  const [reloj, actualizarReloj] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const actualizar = () => {
      const ahora = new Date();
      actualizarReloj(ahora);
      clearTimeout(timer);
      // Recalcula al cambiar de día local (incluido horario de verano).
      timer = setTimeout(actualizar, new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1).getTime() - ahora.getTime() + 100);
    };
    actualizar();
    const sub = AppState.addEventListener('change', (e) => { if (e === 'active') actualizar(); });
    return () => { clearTimeout(timer); sub.remove(); };
  }, []);
  const periodo = useMemo(() => resolverPeriodo(seleccion, reloj), [seleccion, reloj]);
  return <Contexto.Provider value={{ seleccion, periodo, cambiar }}>{children}</Contexto.Provider>;
}

export function usePeriodo() {
  const valor = useContext(Contexto);
  if (!valor) throw new Error('Falta ProveedorPeriodo.');
  return valor;
}
