import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Sistema de diseño inspirado en Apple Human Interface Guidelines (iOS).
 * Soporta Modo Claro, Modo Oscuro, Automático del sistema y Alto Contraste
 * para accesibilidad en bodegas con poca iluminación o daltonismo.
 */

export type PreferenciaTema = 'sistema' | 'claro' | 'oscuro';

export interface Paleta {
  oscura: boolean;
  altoContraste: boolean;
  fondo: string;
  superficie: string;
  superficieElevada: string;
  inputFondo: string;
  barraTab: string;
  texto: string;
  textoSecundario: string;
  textoTerciario: string;
  borde: string;
  separador: string;
  acento: string;
  acentoSuave: string;
  verde: string;
  verdeSuave: string;
  ambar: string;
  ambarSuave: string;
  rojo: string;
  rojoSuave: string;
  chipTexto: string;
}

const PALETA_CLARA: Paleta = {
  oscura: false,
  altoContraste: false,
  fondo: '#F2F2F7',
  superficie: '#FFFFFF',
  superficieElevada: '#F9F9FB',
  inputFondo: '#E9E9EE',
  barraTab: 'rgba(255,255,255,0.96)',
  texto: '#111114',
  textoSecundario: '#5E5E66',
  textoTerciario: '#8E8E93',
  borde: '#E2E2E8',
  separador: '#E5E5EA',
  acento: '#007AFF',
  acentoSuave: '#E8F2FF',
  verde: '#1E9E49',
  verdeSuave: '#E8F8EE',
  ambar: '#D97706',
  ambarSuave: '#FEF3C7',
  rojo: '#DC2626',
  rojoSuave: '#FEE2E2',
  chipTexto: '#FFFFFF',
};

const PALETA_OSCURA: Paleta = {
  oscura: true,
  altoContraste: false,
  fondo: '#000000',
  superficie: '#1C1C1E',
  superficieElevada: '#2C2C2E',
  inputFondo: '#2C2C2E',
  barraTab: 'rgba(22,22,24,0.96)',
  texto: '#F5F5F7',
  textoSecundario: '#AEAEB2',
  textoTerciario: '#8E8E93',
  borde: '#38383A',
  separador: '#2C2C2E',
  acento: '#0A84FF',
  acentoSuave: 'rgba(10,132,255,0.18)',
  verde: '#30D158',
  verdeSuave: 'rgba(48,209,88,0.18)',
  ambar: '#FF9F0A',
  ambarSuave: 'rgba(255,159,10,0.20)',
  rojo: '#FF453A',
  rojoSuave: 'rgba(255,69,58,0.20)',
  chipTexto: '#FFFFFF',
};

function aplicarAltoContraste(base: Paleta): Paleta {
  if (base.oscura) {
    return {
      ...base,
      altoContraste: true,
      texto: '#FFFFFF',
      textoSecundario: '#E5E5EA',
      borde: '#636366',
      acento: '#409CFF',
      verde: '#32D74B',
      ambar: '#FFD60A',
      rojo: '#FF6961',
    };
  }
  return {
    ...base,
    altoContraste: true,
    fondo: '#EAEAEF',
    texto: '#000000',
    textoSecundario: '#1C1C1E',
    borde: '#8E8E93',
    acento: '#0040DD',
    verde: '#116B2E',
    ambar: '#9A4E00',
    rojo: '#B00020',
  };
}

/** Compatibilidad retroactiva para constantes estáticas. */
export const C = {
  azul: '#007AFF',
  azulOscuro: '#0051A8',
  navy: '#111114',
  teal: '#14B8A6',
  verde: '#1E9E49',
  ambar: '#D97706',
  rojo: '#DC2626',
  gris: '#5E5E66',
  linea: '#E2E2E8',
  fondo: '#F2F2F7',
  blanco: '#FFFFFF',
};

export function coloresEstado(p: Paleta) {
  return {
    agotado: { fg: p.rojo, bg: p.rojoSuave },
    bajo: { fg: p.ambar, bg: p.ambarSuave },
    ok: { fg: p.verde, bg: p.verdeSuave },
  } as const;
}

/**
 * 48 dp / pt es el área táctil mínima accesible (Apple HIG ≥ 44 pt / Material ≥ 48 dp).
 * En bodega el operador suele sostener una caja con la otra mano.
 */
export const TOQUE_MINIMO = 48;

export const VERSION_APP = '1.2.0';

const CLAVE_PREFS = 'prefs_ui_v1';

interface ContextoTema {
  paleta: Paleta;
  preferencia: PreferenciaTema;
  altoContraste: boolean;
  cambiarPreferencia: (p: PreferenciaTema) => void;
  alternarAltoContraste: () => void;
}

const TemaCtx = createContext<ContextoTema>({
  paleta: PALETA_CLARA,
  preferencia: 'sistema',
  altoContraste: false,
  cambiarPreferencia: () => {},
  alternarAltoContraste: () => {},
});

export function ProveedorTema({ children }: { children: React.ReactNode }) {
  const esquemaSistema = useColorScheme();
  const [preferencia, setPreferencia] = useState<PreferenciaTema>('sistema');
  const [altoContraste, setAltoContraste] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(CLAVE_PREFS)
      .then((crudo) => {
        if (!crudo) return;
        const parsed = JSON.parse(crudo) as {
          preferencia?: PreferenciaTema;
          altoContraste?: boolean;
        };
        if (
          parsed.preferencia === 'sistema' ||
          parsed.preferencia === 'claro' ||
          parsed.preferencia === 'oscuro'
        ) {
          setPreferencia(parsed.preferencia);
        }
        if (typeof parsed.altoContraste === 'boolean') {
          setAltoContraste(parsed.altoContraste);
        }
      })
      .catch(() => {});
  }, []);

  const guardar = useCallback((pref: PreferenciaTema, hc: boolean) => {
    AsyncStorage.setItem(CLAVE_PREFS, JSON.stringify({ preferencia: pref, altoContraste: hc })).catch(
      () => {}
    );
  }, []);

  const cambiarPreferencia = useCallback(
    (nueva: PreferenciaTema) => {
      setPreferencia(nueva);
      guardar(nueva, altoContraste);
    },
    [altoContraste, guardar]
  );

  const alternarAltoContraste = useCallback(() => {
    setAltoContraste((actual) => {
      const sig = !actual;
      guardar(preferencia, sig);
      return sig;
    });
  }, [preferencia, guardar]);

  const paleta = useMemo(() => {
    const usarOscuro =
      preferencia === 'oscuro' || (preferencia === 'sistema' && esquemaSistema === 'dark');
    const base = usarOscuro ? PALETA_OSCURA : PALETA_CLARA;
    return altoContraste ? aplicarAltoContraste(base) : base;
  }, [preferencia, esquemaSistema, altoContraste]);

  const valor = useMemo(
    () => ({
      paleta,
      preferencia,
      altoContraste,
      cambiarPreferencia,
      alternarAltoContraste,
    }),
    [paleta, preferencia, altoContraste, cambiarPreferencia, alternarAltoContraste]
  );

  return <TemaCtx.Provider value={valor}>{children}</TemaCtx.Provider>;
}

export function useTema(): ContextoTema {
  return useContext(TemaCtx);
}
