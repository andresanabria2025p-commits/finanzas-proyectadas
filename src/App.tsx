/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Profile,
  Config,
  Income,
  Expense,
  Liability,
  Transaction,
  RealizedMovement,
  LedgerRow,
  TrashItem
} from './types';
import { calculateLedger } from './utils/engine';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import FormManager from './components/FormManager';
import Cronograma from './components/Cronograma';
import {
  Sun,
  Moon,
  TrendingUp,
  LayoutDashboard,
  Calendar,
  Layers,
  Sparkles,
  Wallet,
  Menu,
  X,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Database,
  Lock,
  Unlock,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Eye,
  EyeOff,
  Cloud
} from 'lucide-react';
import LockScreen from './components/LockScreen';
import { auth, db, googleProvider, OperationType, handleFirestoreError } from './utils/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, getDocs, setDoc, deleteDoc, collection } from 'firebase/firestore';

// Datos por defecto enriquecidos para inicialización del perfil principal
const DEFAULT_CONFIG: Config = {
  initial_balance: 1500,
  start_date: '2026-06-01',
  end_date: '2026-12-31',
  safety_margin: 300
};

const DEFAULT_INCOMES: Income[] = [
  { id: 101, day_of_month: 5, amount: 1500 },
  { id: 102, day_of_month: 20, amount: 1200 }
];

const DEFAULT_EXPENSES: Expense[] = [
  { id: 201, name: 'Alquiler de Vivienda', frequency: 'Mensual', amount: 500, day_of_execution: 10, can_delay: 0 },
  { id: 202, name: 'Suscripciones de Streaming', frequency: 'Mensual', amount: 25, day_of_execution: 15, can_delay: 1 },
  { id: 203, name: 'Gasolina y Transporte', frequency: 'Semanal', amount: 45, day_of_execution: 1, can_delay: 0 },
  { id: 204, name: 'Despensa y Alimentos', frequency: 'Semanal', amount: 110, day_of_execution: 1, can_delay: 1 }
];

const DEFAULT_LIABILITIES: Liability[] = [
  {
    id: 301,
    name: 'Crédito de Automóvil',
    total_amount: 8000,
    installment_amount: 210,
    due_day: 12,
    end_date: '2026-11-30',
    debt_type: 'Prestamo',
    cut_off_day: null,
    frequency: 'Mensual',
    credit_limit: 0,
    payment_plan: 'Minimo',
    can_delay: 0,
    start_date: '2026-06-01'
  },
  {
    id: 302,
    name: 'Tarjeta Visa Oro',
    total_amount: 450,
    installment_amount: 50,
    due_day: 25,
    end_date: '2099-12-31',
    debt_type: 'TDC',
    cut_off_day: 10,
    frequency: 'Mensual',
    credit_limit: 3000,
    payment_plan: 'Minimo',
    can_delay: 1,
    start_date: '2026-06-01'
  }
];

const DEFAULT_TRANSACTIONS: Transaction[] = [
  { id: 401, date: '2026-06-07', concept: 'Cena Restaurante Italiana', amount: -65, credit_card_id: null },
  { id: 402, date: '2526-06-12', concept: 'Trabajo Free freelance', amount: 250, credit_card_id: null },
  { id: 403, date: '2026-06-14', concept: 'Suscripción Netflix Familiar', amount: -18, credit_card_id: 302 }
];

export default function App() {
  // --- TEMAS (OSCURO / CLARO) ---
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // --- ADMINISTRACIÓN DE PERFILES ---
  const [profiles, setProfiles] = useState<Profile[]>(() => {
    const saved = localStorage.getItem('profiles_list');
    return saved ? JSON.parse(saved) : [{ id: 1, name: 'Presupuesto Personal' }];
  });

  const [currentProfileId, setCurrentProfileId] = useState<number>(() => {
    const saved = localStorage.getItem('active_profile_id');
    return saved ? parseInt(saved) : 1;
  });

  const [showAddProfileModal, setShowAddProfileModal] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [showDeleteProfileModal, setShowDeleteProfileModal] = useState(false);

  // --- CLAVE / PIN DE ACCESO LOCAL ---
  const [appPasscode, setAppPasscode] = useState<string | null>(() => {
    return localStorage.getItem('app_passcode');
  });
  const [isLocked, setIsLocked] = useState<boolean>(() => {
    return !!localStorage.getItem('app_passcode');
  });
  const [showSetupPasscodeModal, setShowSetupPasscodeModal] = useState(false);
  const [showClearPasscodeModal, setShowClearPasscodeModal] = useState(false);
  const [setupPasscoodeInput, setSetupPasscoodeInput] = useState('');
  const [setupPasscodeConfirm, setSetupPasscodeConfirm] = useState('');
  const [clearPasscodeInput, setClearPasscodeInput] = useState('');

  // --- IMPORTACION / EXPORTACION DE RESPALDOS ---
  const [importPendingData, setImportPendingData] = useState<any | null>(null);
  const [importFileName, setImportFileName] = useState<string>('');
  const [importOptionSingle, setImportOptionSingle] = useState<'new_profile' | 'replace_active'>('new_profile');

  // --- ESTADOS DE AUTENTICACION Y SINCRONIZACION CLOUD ---
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [showSyncMergeModal, setShowSyncMergeModal] = useState(false);
  const [cloudProfilesList, setCloudProfilesList] = useState<Profile[]>([]);

  // --- ESTADOS FINANCIEROS DEL PERFIL SELECCIONADO ---
  const getProfileKey = (key: string) => `profiles_data_${currentProfileId}_${key}`;

  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [realizedMovements, setRealizedMovements] = useState<RealizedMovement[]>([]);
  const [trashBin, setTrashBin] = useState<TrashItem[]>([]);

  // Notificaciones flotantes Toast
  const [toasts, setToasts] = useState<{ id: string; text: string; type: 'success' | 'info' | 'warn' }[]>([]);

  const showToast = (text: string, type: 'success' | 'info' | 'warn' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // --- ESCUCHA DE AUTENTICACION EN TIEMPO REAL ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        // Cargar Pin o Passcode del servidor si estuviera configurado
        try {
          const userDoc = await getDoc(doc(db, 'users', u.uid));
          if (userDoc.exists()) {
            const d = userDoc.data();
            if (d.appPasscode) {
              setAppPasscode(d.appPasscode);
              localStorage.setItem('app_passcode', d.appPasscode);
            }
          }
        } catch (e) {
          console.error("No se pudo descargar el pin del servidor:", e);
        }
      } else {
        setUser(null);
      }
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      setIsAuthLoading(true);
      const result = await signInWithPopup(auth, googleProvider);
      setUser(result.user);
      showToast(`Sesión iniciada con éxito como ${result.user.email}`, 'success');
      await evaluateCloudDataOnLogin(result.user);
    } catch (err) {
      console.error("Error al iniciar sesión con Google:", err);
      showToast('Error al iniciar sesión con Google.', 'warn');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleGoogleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      showToast('Sesión cerrada correctamente. Volviendo a modo local.', 'info');
      // Forzar recarga para limpiar memoria local temporal
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      console.error(err);
      showToast('Error al cerrar sesión.', 'warn');
    }
  };

  const evaluateCloudDataOnLogin = async (loggedUser: User) => {
    setIsCloudSyncing(true);
    try {
      const q = collection(db, 'users', loggedUser.uid, 'profiles');
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        // La base de datos está vacía. Es un primer inicio de sesión, ofrecemos subir los datos locales.
        setCloudProfilesList([]);
        setShowSyncMergeModal(true);
      } else {
        // La nube ya tiene perfiles existentes, mostramos el modal para elegir descarga o sobreescritura/unión.
        const cloudProfs: Profile[] = [];
        snapshot.forEach(docSnap => {
          const d = docSnap.data();
          cloudProfs.push({ id: Number(d.id), name: d.name });
        });
        setCloudProfilesList(cloudProfs);
        setShowSyncMergeModal(true);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `users/${loggedUser.uid}/profiles`);
      showToast('Error al evaluar los respaldos de la nube.', 'warn');
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const handleDownloadCloudData = async () => {
    if (!user) return;
    setIsCloudSyncing(true);
    try {
      const q = collection(db, 'users', user.uid, 'profiles');
      const snapshot = await getDocs(q);
      
      const loadedProfilesList: Profile[] = [];
      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        const pid = Number(d.id);
        loadedProfilesList.push({ id: pid, name: d.name });
        
        const pKey = (k: string) => `profiles_data_${pid}_${k}`;
        localStorage.setItem(pKey('config'), JSON.stringify(d.config || DEFAULT_CONFIG));
        localStorage.setItem(pKey('incomes'), JSON.stringify(d.incomes || []));
        localStorage.setItem(pKey('expenses'), JSON.stringify(d.expenses || []));
        localStorage.setItem(pKey('liabilities'), JSON.stringify(d.liabilities || []));
        localStorage.setItem(pKey('transactions'), JSON.stringify(d.transactions || []));
        localStorage.setItem(pKey('realizedMovements'), JSON.stringify(d.realizedMovements || []));
        localStorage.setItem(pKey('trash_bin'), JSON.stringify(d.trash_bin || []));
      });

      if (loadedProfilesList.length > 0) {
        setProfiles(loadedProfilesList);
        localStorage.setItem('profiles_list', JSON.stringify(loadedProfilesList));
        
        const firstId = loadedProfilesList[0].id;
        setCurrentProfileId(firstId);

        // Alimentar estados reactivos
        const pKey = (k: string) => `profiles_data_${firstId}_${k}`;
        setConfig(JSON.parse(localStorage.getItem(pKey('config')) || JSON.stringify(DEFAULT_CONFIG)));
        setIncomes(JSON.parse(localStorage.getItem(pKey('incomes')) || '[]'));
        setExpenses(JSON.parse(localStorage.getItem(pKey('expenses')) || '[]'));
        setLiabilities(JSON.parse(localStorage.getItem(pKey('liabilities')) || '[]'));
        setTransactions(JSON.parse(localStorage.getItem(pKey('transactions')) || '[]'));
        setRealizedMovements(JSON.parse(localStorage.getItem(pKey('realizedMovements')) || '[]'));
        setTrashBin(JSON.parse(localStorage.getItem(pKey('trash_bin')) || '[]'));

        showToast('¡Datos de la nube sincronizados en tu dispositivo!', 'success');
      } else {
        showToast('No se encontraron datos en tu cuenta.', 'warn');
      }
      setShowSyncMergeModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `users/${user.uid}/profiles`);
      showToast('Error al descargar los perfiles del servidor.', 'warn');
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const handleUploadLocalDataToCloud = async () => {
    if (!user) return;
    setIsCloudSyncing(true);
    try {
      for (const p of profiles) {
        const pKey = (k: string) => `profiles_data_${p.id}_${k}`;
        
        const savedConfig = JSON.parse(localStorage.getItem(pKey('config')) || JSON.stringify(DEFAULT_CONFIG));
        const savedIncomes = JSON.parse(localStorage.getItem(pKey('incomes')) || (p.id === 1 ? JSON.stringify(DEFAULT_INCOMES) : '[]'));
        const savedExpenses = JSON.parse(localStorage.getItem(pKey('expenses')) || (p.id === 1 ? JSON.stringify(DEFAULT_EXPENSES) : '[]'));
        const savedLiabilities = JSON.parse(localStorage.getItem(pKey('liabilities')) || (p.id === 1 ? JSON.stringify(DEFAULT_LIABILITIES) : '[]'));
        const savedTransactions = JSON.parse(localStorage.getItem(pKey('transactions')) || (p.id === 1 ? JSON.stringify(DEFAULT_TRANSACTIONS) : '[]'));
        const savedRealized = JSON.parse(localStorage.getItem(pKey('realizedMovements')) || '[]');
        const savedTrash = JSON.parse(localStorage.getItem(pKey('trash_bin')) || '[]');

        const profileDocRef = doc(db, 'users', user.uid, 'profiles', String(p.id));
        await setDoc(profileDocRef, {
          id: String(p.id),
          name: p.name,
          config: savedConfig,
          incomes: savedIncomes,
          expenses: savedExpenses,
          liabilities: savedLiabilities,
          transactions: savedTransactions,
          realizedMovements: savedRealized,
          trash_bin: savedTrash,
          updatedAt: new Date().toISOString()
        });
      }
      showToast('¡Respaldo exitoso! Todo tu presupuesto se subió a la nube.', 'success');
      setShowSyncMergeModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/profiles`);
      showToast('Error al respaldar la información local.', 'warn');
    } finally {
      setIsCloudSyncing(false);
    }
  };

  // --- CARGA DE DATOS BASADO EN PERFIL SELECCIONADO ---
  useEffect(() => {
    localStorage.setItem('active_profile_id', String(currentProfileId));
    localStorage.setItem('profiles_list', JSON.stringify(profiles));

    // Cargar Config
    const savedConf = localStorage.getItem(getProfileKey('config'));
    if (savedConf) {
      setConfig(JSON.parse(savedConf));
    } else {
      setConfig(DEFAULT_CONFIG);
      localStorage.setItem(getProfileKey('config'), JSON.stringify(DEFAULT_CONFIG));
    }

    // Cargar Ingresos
    const savedIncomes = localStorage.getItem(getProfileKey('incomes'));
    if (savedIncomes) {
      setIncomes(JSON.parse(savedIncomes));
    } else {
      const init = currentProfileId === 1 ? DEFAULT_INCOMES : [];
      setIncomes(init);
      localStorage.setItem(getProfileKey('incomes'), JSON.stringify(init));
    }

    // Cargar Gastos
    const savedExpenses = localStorage.getItem(getProfileKey('expenses'));
    if (savedExpenses) {
      setExpenses(JSON.parse(savedExpenses));
    } else {
      const init = currentProfileId === 1 ? DEFAULT_EXPENSES : [];
      setExpenses(init);
      localStorage.setItem(getProfileKey('expenses'), JSON.stringify(init));
    }

    // Cargar Deudas
    const savedLiabilities = localStorage.getItem(getProfileKey('liabilities'));
    if (savedLiabilities) {
      setLiabilities(JSON.parse(savedLiabilities));
    } else {
      const init = currentProfileId === 1 ? DEFAULT_LIABILITIES : [];
      setLiabilities(init);
      localStorage.setItem(getProfileKey('liabilities'), JSON.stringify(init));
    }

    // Cargar Transacciones
    const savedTxns = localStorage.getItem(getProfileKey('transactions'));
    if (savedTxns) {
      setTransactions(JSON.parse(savedTxns));
    } else {
      const init = currentProfileId === 1 ? DEFAULT_TRANSACTIONS : [];
      setTransactions(init);
      localStorage.setItem(getProfileKey('transactions'), JSON.stringify(init));
    }

    // Cargar Realizados / Conciliados
    const savedRealized = localStorage.getItem(getProfileKey('realizedMovements'));
    setRealizedMovements(savedRealized ? JSON.parse(savedRealized) : []);

    // Cargar Papelera
    const savedTrash = localStorage.getItem(getProfileKey('trash_bin'));
    setTrashBin(savedTrash ? JSON.parse(savedTrash) : []);

  }, [currentProfileId]);

  // --- SATELLITE PERSISTENCIA AL MODIFICAR VARIABLES UNIFICADA ---
  const persistProfile = async (
    profileId: number,
    updatedFields: {
      name?: string;
      config?: Config;
      incomes?: Income[];
      expenses?: Expense[];
      liabilities?: Liability[];
      transactions?: Transaction[];
      realizedMovements?: RealizedMovement[];
      trash_bin?: TrashItem[];
    }
  ) => {
    // 1. Modificar estados React del perfil activo actualmente
    if (profileId === currentProfileId) {
      if (updatedFields.config !== undefined) setConfig(updatedFields.config);
      if (updatedFields.incomes !== undefined) setIncomes(updatedFields.incomes);
      if (updatedFields.expenses !== undefined) setExpenses(updatedFields.expenses);
      if (updatedFields.liabilities !== undefined) setLiabilities(updatedFields.liabilities);
      if (updatedFields.transactions !== undefined) setTransactions(updatedFields.transactions);
      if (updatedFields.realizedMovements !== undefined) setRealizedMovements(updatedFields.realizedMovements);
      if (updatedFields.trash_bin !== undefined) setTrashBin(updatedFields.trash_bin);
    }

    // 2. Modificar localStorage
    const pKey = (k: string) => `profiles_data_${profileId}_${k}`;
    if (updatedFields.name !== undefined) {
      const updatedProfilesList = profiles.map(p => p.id === profileId ? { ...p, name: updatedFields.name! } : p);
      setProfiles(updatedProfilesList);
      localStorage.setItem('profiles_list', JSON.stringify(updatedProfilesList));
    }
    if (updatedFields.config !== undefined) localStorage.setItem(pKey('config'), JSON.stringify(updatedFields.config));
    if (updatedFields.incomes !== undefined) localStorage.setItem(pKey('incomes'), JSON.stringify(updatedFields.incomes));
    if (updatedFields.expenses !== undefined) localStorage.setItem(pKey('expenses'), JSON.stringify(updatedFields.expenses));
    if (updatedFields.liabilities !== undefined) localStorage.setItem(pKey('liabilities'), JSON.stringify(updatedFields.liabilities));
    if (updatedFields.transactions !== undefined) localStorage.setItem(pKey('transactions'), JSON.stringify(updatedFields.transactions));
    if (updatedFields.realizedMovements !== undefined) localStorage.setItem(pKey('realizedMovements'), JSON.stringify(updatedFields.realizedMovements));
    if (updatedFields.trash_bin !== undefined) localStorage.setItem(pKey('trash_bin'), JSON.stringify(updatedFields.trash_bin));

    // 3. Sincronización en la Nube si hay sesión iniciada de Firebase Auth
    if (auth.currentUser) {
      try {
        const profileDocRef = doc(db, 'users', auth.currentUser.uid, 'profiles', String(profileId));

        const displayName = updatedFields.name ?? (profiles.find(p => p.id === profileId)?.name || 'Perfil');
        const docConfig = updatedFields.config ?? (profileId === currentProfileId ? config : JSON.parse(localStorage.getItem(pKey('config')) || JSON.stringify(DEFAULT_CONFIG)));
        const docIncomes = updatedFields.incomes ?? (profileId === currentProfileId ? incomes : JSON.parse(localStorage.getItem(pKey('incomes')) || '[]'));
        const docExpenses = updatedFields.expenses ?? (profileId === currentProfileId ? expenses : JSON.parse(localStorage.getItem(pKey('expenses')) || '[]'));
        const docLiabilities = updatedFields.liabilities ?? (profileId === currentProfileId ? liabilities : JSON.parse(localStorage.getItem(pKey('liabilities')) || '[]'));
        const docTransactions = updatedFields.transactions ?? (profileId === currentProfileId ? transactions : JSON.parse(localStorage.getItem(pKey('transactions')) || '[]'));
        const docRealized = updatedFields.realizedMovements ?? (profileId === currentProfileId ? realizedMovements : JSON.parse(localStorage.getItem(pKey('realizedMovements')) || '[]'));
        const docTrash = updatedFields.trash_bin ?? (profileId === currentProfileId ? trashBin : JSON.parse(localStorage.getItem(pKey('trash_bin')) || '[]'));

        await setDoc(profileDocRef, {
          id: String(profileId),
          name: displayName,
          config: docConfig,
          incomes: docIncomes,
          expenses: docExpenses,
          liabilities: docLiabilities,
          transactions: docTransactions,
          realizedMovements: docRealized,
          trash_bin: docTrash,
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${auth.currentUser.uid}/profiles/${profileId}`);
      }
    }
  };

  const saveConfig = (newCfg: Config) => {
    persistProfile(currentProfileId, { config: newCfg });
    showToast('Ciclo presupuestario actualizado.', 'success');
  };

  const saveIncomesList = (list: Income[]) => {
    persistProfile(currentProfileId, { incomes: list });
  };

  const saveExpensesList = (list: Expense[]) => {
    persistProfile(currentProfileId, { expenses: list });
  };

  const saveLiabilitiesList = (list: Liability[]) => {
    persistProfile(currentProfileId, { liabilities: list });
  };

  const saveTransactionsList = (list: Transaction[]) => {
    persistProfile(currentProfileId, { transactions: list });
  };

  const saveRealizedList = (list: RealizedMovement[]) => {
    persistProfile(currentProfileId, { realizedMovements: list });
  };

  const saveTrashBin = (list: TrashItem[]) => {
    persistProfile(currentProfileId, { trash_bin: list });
  };

  // --- OPERACIONES CRUD PRINCIPALES ---
  // Edición temporal de elementos
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editingLiability, setEditingLiability] = useState<Liability | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // 1. Ingresos
  const handleAddIncome = (inc: Omit<Income, 'id'> & { id?: number }) => {
    if (editingIncome && inc.id) {
      const idx = incomes.findIndex(x => x.id === inc.id);
      if (idx !== -1) {
        const updated = [...incomes];
        updated[idx] = { id: inc.id, day_of_month: inc.day_of_month, amount: inc.amount };
        saveIncomesList(updated);
        showToast('Cobro sistemático actualizado.', 'success');
      }
      setEditingIncome(null);
    } else {
      const newItem: Income = {
        id: Date.now(),
        day_of_month: inc.day_of_month,
        amount: inc.amount
      };
      saveIncomesList([...incomes, newItem]);
      showToast('Cobro sistemático registrado.', 'success');
    }
  };

  const handleDeleteIncome = (id: number) => {
    const target = incomes.find(x => x.id === id);
    if (!target) return;
    saveIncomesList(incomes.filter(x => x.id !== id));
    
    // Envíar a papelera
    const trashItem: TrashItem = {
      date: config.start_date,
      type: 'Ingreso Habitual',
      concept: `Ingreso habitual (Día ${target.day_of_month})`,
      amount: target.amount,
      liquidity: 0,
      status: 'Omitido',
      movement_type: 'income',
      source_id: target.id,
      original_date: config.start_date,
      projected_amount: target.amount,
      deletedAt: Date.now(),
      originalItem: JSON.stringify(target)
    };
    saveTrashBin([trashItem, ...trashBin]);
    showToast('Ingreso removido. Remitido a papelera.', 'warn');
  };

  // 2. Gastos
  const handleAddExpense = (exp: Omit<Expense, 'id'> & { id?: number }) => {
    if (editingExpense && exp.id) {
      const idx = expenses.findIndex(x => x.id === exp.id);
      if (idx !== -1) {
        const updated = [...expenses];
        updated[idx] = {
          id: exp.id,
          name: exp.name,
          frequency: exp.frequency,
          amount: exp.amount,
          day_of_execution: exp.day_of_execution,
          can_delay: exp.can_delay
        };
        saveExpensesList(updated);
        showToast('Gasto sistemático actualizado.', 'success');
      }
      setEditingExpense(null);
    } else {
      const newItem: Expense = {
        id: Date.now(),
        name: exp.name,
        frequency: exp.frequency,
        amount: exp.amount,
        day_of_execution: exp.day_of_execution,
        can_delay: exp.can_delay
      };
      saveExpensesList([...expenses, newItem]);
      showToast('Gasto habitual registrado.', 'success');
    }
  };

  const handleDeleteExpense = (id: number) => {
    const target = expenses.find(x => x.id === id);
    if (!target) return;
    saveExpensesList(expenses.filter(x => x.id !== id));

    const trashItem: TrashItem = {
      date: config.start_date,
      type: 'Gasto Habitual',
      concept: target.name,
      amount: -target.amount,
      liquidity: 0,
      status: 'Omitido',
      movement_type: 'expense',
      source_id: target.id,
      original_date: config.start_date,
      projected_amount: target.amount,
      deletedAt: Date.now(),
      originalItem: JSON.stringify(target)
    };
    saveTrashBin([trashItem, ...trashBin]);
    showToast('Gasto eliminado. Remitido a papelera.', 'warn');
  };

  // 3. Deudas y Tarjetas
  const handleAddLiability = (liab: Omit<Liability, 'id'> & { id?: number }) => {
    if (editingLiability && liab.id) {
      const idx = liabilities.findIndex(x => x.id === liab.id);
      if (idx !== -1) {
        const updated = [...liabilities];
        updated[idx] = {
          id: liab.id,
          name: liab.name,
          total_amount: liab.total_amount,
          installment_amount: liab.installment_amount,
          due_day: liab.due_day,
          end_date: liab.end_date,
          debt_type: liab.debt_type,
          cut_off_day: liab.cut_off_day,
          frequency: liab.frequency,
          credit_limit: liab.credit_limit,
          payment_plan: liab.payment_plan,
          can_delay: liab.can_delay,
          start_date: liab.start_date
        };
        saveLiabilitiesList(updated);
        showToast('Compromiso de deuda actualizado.', 'success');
      }
      setEditingLiability(null);
    } else {
      const newItem: Liability = {
        id: Date.now(),
        name: liab.name,
        total_amount: liab.total_amount,
        installment_amount: liab.installment_amount,
        due_day: liab.due_day,
        end_date: liab.end_date,
        debt_type: liab.debt_type,
        cut_off_day: liab.cut_off_day,
        frequency: liab.frequency,
        credit_limit: liab.credit_limit,
        payment_plan: liab.payment_plan,
        can_delay: liab.can_delay,
        start_date: liab.start_date
      };
      saveLiabilitiesList([...liabilities, newItem]);
      showToast('Préstamo o Cuenta registrado.', 'success');
    }
  };

  const handleDeleteLiability = (id: number) => {
    const target = liabilities.find(x => x.id === id);
    if (!target) return;
    saveLiabilitiesList(liabilities.filter(x => x.id !== id));

    const trashItem: TrashItem = {
      date: config.start_date,
      type: 'Crédito Deuda',
      concept: target.name,
      amount: -target.total_amount,
      liquidity: 0,
      status: 'Omitido',
      movement_type: 'liability',
      source_id: target.id,
      original_date: config.start_date,
      projected_amount: target.total_amount,
      deletedAt: Date.now(),
      originalItem: JSON.stringify(target)
    };
    saveTrashBin([trashItem, ...trashBin]);
    showToast('Compromiso financiero removido.', 'warn');
  };

  // 4. Transacciones Manuales Diarias
  const handleAddTransaction = (txn: Omit<Transaction, 'id'> & { id?: number }) => {
    if (editingTransaction && txn.id) {
      const idx = transactions.findIndex(x => x.id === txn.id);
      if (idx !== -1) {
        const updated = [...transactions];
        updated[idx] = {
          id: txn.id,
          date: txn.date,
          concept: txn.concept,
          amount: txn.amount,
          credit_card_id: txn.credit_card_id
        };
        saveTransactionsList(updated);
        showToast('Transacción diaria actualizada.', 'success');
      }
      setEditingTransaction(null);
    } else {
      const newItem: Transaction = {
        id: Date.now(),
        date: txn.date,
        concept: txn.concept,
        amount: txn.amount,
        credit_card_id: txn.credit_card_id
      };
      saveTransactionsList([...transactions, newItem]);
      showToast('Gasto/Ingreso diario registrado.', 'success');
    }
  };

  const handleDeleteTransaction = (id: number) => {
    const target = transactions.find(x => x.id === id);
    if (!target) return;
    saveTransactionsList(transactions.filter(x => x.id !== id));

    const trashItem: TrashItem = {
      date: target.date,
      type: 'Transacción Diario',
      concept: target.concept,
      amount: target.amount,
      liquidity: 0,
      status: 'Omitido',
      movement_type: 'transaction',
      source_id: target.id,
      original_date: target.date,
      projected_amount: target.amount,
      deletedAt: Date.now(),
      originalItem: JSON.stringify(target)
    };
    saveTrashBin([trashItem, ...trashBin]);
    showToast('Transacción removida.', 'warn');
  };

  // 5. Conciliación / Realizados / Omitidos
  const handleConfirmRealizedStatus = (
    movementType: string,
    sourceId: number,
    dateStr: string,
    projectedAmount: number,
    actualAmount: number,
    status: 'Realizado' | 'Omitido'
  ) => {
    // Buscar si ya existía una conciliación previa para esta ocurrencia
    const updated = realizedMovements.filter(
      r => !(r.movement_type === movementType && r.source_id === sourceId && r.date === dateStr)
    );

    const record: RealizedMovement = {
      movement_type: movementType,
      source_id: sourceId,
      date: dateStr,
      projected_amount: projectedAmount,
      actual_amount: actualAmount,
      status: status
    };

    saveRealizedList([...updated, record]);
    showToast(status === 'Omitido' ? 'Movimiento ignorado con éxito.' : 'Operación conciliada en la fecha.', 'success');
  };

  const handleDeleteRealizedStatus = (movementType: string, sourceId: number, dateStr: string) => {
    const updated = realizedMovements.filter(
      r => !(r.movement_type === movementType && r.source_id === sourceId && r.date === dateStr)
    );
    saveRealizedList(updated);
    showToast('Conciliación revertida. Estatus restaurado a programado.', 'info');
  };

  const handleRestoreTrash = (item: TrashItem) => {
    if (!item.originalItem) {
      showToast('No se puede recuperar: Faltan metadatos del objeto original.', 'warn');
      return;
    }
    try {
      const parsed = JSON.parse(item.originalItem);
      if (item.movement_type === 'income') {
        saveIncomesList([...incomes, parsed]);
        showToast('Cobro sistemático recuperado con éxito.', 'success');
      } else if (item.movement_type === 'expense') {
        saveExpensesList([...expenses, parsed]);
        showToast('Gasto sistemático recuperado con éxito.', 'success');
      } else if (item.movement_type === 'liability') {
        saveLiabilitiesList([...liabilities, parsed]);
        showToast('Compromiso financiero recuperado con éxito.', 'success');
      } else if (item.movement_type === 'transaction') {
        saveTransactionsList([...transactions, parsed]);
        showToast('Transacción diaria recuperada con éxito.', 'success');
      } else {
        showToast('Tipo de movimiento desconocido.', 'warn');
        return;
      }
      
      // Remover de la papelera
      saveTrashBin(trashBin.filter(x => !(x.source_id === item.source_id && x.movement_type === item.movement_type)));
    } catch (e) {
      showToast('Error al intentar recuperar el elemento.', 'warn');
    }
  };

  // Vaciar Papelera
  const handleEmptyTrash = () => {
    saveTrashBin([]);
    showToast('Papelera de reciclaje completamente vaciada.', 'success');
  };

  // --- COMPILACIÓN DEL LEDGER DE CAJA ---
  // Se optimiza para ejecutar el cálculo únicamente cuando cambian sus dependencias en memoria
  const ledgerData = useMemo(() => {
    return calculateLedger(
      config,
      incomes,
      expenses,
      liabilities,
      transactions,
      realizedMovements
    );
  }, [config, incomes, expenses, liabilities, transactions, realizedMovements]);

  // --- ADMINISTRACIÓN DE SELECCIÓN DE PESTAÑAS (SPA) ---
  const [activeTab, setActiveTab] = useState<'dashboard' | 'formularios' | 'cronograma'>('dashboard');

  // Scrolling interactivo y efecto de pulso desde las notificaciones del sidebar para apuntar un registro
  const handleScrollToRow = (movementType: string, sourceId: number, originalDate: string) => {
    setActiveTab('cronograma');
    setTimeout(() => {
      const targetId = `ledger-row-${movementType}-${sourceId}-${originalDate}`;
      const element = document.getElementById(targetId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('row-highlight-active');
        setTimeout(() => {
          element.classList.remove('row-highlight-active');
        }, 3000);
      }
    }, 150);
  };

  // Modal para agregar perfil
  const handleCreateProfile = async () => {
    const name = newProfileName.trim();
    if (!name) return;

    const newId = profiles.length > 0 ? Math.max(...profiles.map(p => p.id)) + 1 : 1;
    const newProf: Profile = { id: newId, name };
    
    // Guardar local y nube
    const updatedProfilesList = [...profiles, newProf];
    setProfiles(updatedProfilesList);
    localStorage.setItem('profiles_list', JSON.stringify(updatedProfilesList));
    setCurrentProfileId(newId);
    setNewProfileName('');
    setShowAddProfileModal(false);

    await persistProfile(newId, {
      name,
      config: DEFAULT_CONFIG,
      incomes: [],
      expenses: [],
      liabilities: [],
      transactions: [],
      realizedMovements: [],
      trash_bin: []
    });

    showToast(`Perfil de presupuesto "${name}" creado.`, 'success');
  };

  const handleDeleteProfile = () => {
    if (profiles.length <= 1) return;
    setShowDeleteProfileModal(true);
  };

  const handleConfirmDeleteProfile = async () => {
    if (profiles.length <= 1) return;
    const deletedId = currentProfileId;
    const filtered = profiles.filter(p => p.id !== deletedId);
    
    // Limpiar llaves residuales de este perfil en localStorage
    localStorage.removeItem(`profiles_data_${deletedId}_config`);
    localStorage.removeItem(`profiles_data_${deletedId}_incomes`);
    localStorage.removeItem(`profiles_data_${deletedId}_expenses`);
    localStorage.removeItem(`profiles_data_${deletedId}_liabilities`);
    localStorage.removeItem(`profiles_data_${deletedId}_transactions`);
    localStorage.removeItem(`profiles_data_${deletedId}_realizedMovements`);
    localStorage.removeItem(`profiles_data_${deletedId}_trash_bin`);

    setProfiles(filtered);
    localStorage.setItem('profiles_list', JSON.stringify(filtered));
    
    const nextActive = filtered[0].id;
    setCurrentProfileId(nextActive);

    // Actualizar estados reactivos inmediatos
    const pKey = (k: string) => `profiles_data_${nextActive}_${k}`;
    setConfig(JSON.parse(localStorage.getItem(pKey('config')) || JSON.stringify(DEFAULT_CONFIG)));
    setIncomes(JSON.parse(localStorage.getItem(pKey('incomes')) || '[]'));
    setExpenses(JSON.parse(localStorage.getItem(pKey('expenses')) || '[]'));
    setLiabilities(JSON.parse(localStorage.getItem(pKey('liabilities')) || '[]'));
    setTransactions(JSON.parse(localStorage.getItem(pKey('transactions')) || '[]'));
    setRealizedMovements(JSON.parse(localStorage.getItem(pKey('realizedMovements')) || '[]'));
    setTrashBin(JSON.parse(localStorage.getItem(pKey('trash_bin')) || '[]'));

    // Eliminar de Firebase si está autenticado
    if (auth.currentUser) {
      try {
        await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'profiles', String(deletedId)));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${auth.currentUser.uid}/profiles/${deletedId}`);
      }
    }

    setShowDeleteProfileModal(false);
    showToast('Perfil de presupuesto borrado permanentemente.', 'warn');
  };

  // --- FUNCIONES DE PROTECCIÓN DE ACCESO POR PIN/CLAVE ---
  const handleConfirmSetupPasscode = async () => {
    const input = setupPasscoodeInput.trim();
    const conf = setupPasscodeConfirm.trim();

    if (!input) {
      showToast('La clave o PIN no puede estar en blanco.', 'warn');
      return;
    }
    if (input !== conf) {
      showToast('Las claves introducidas no coinciden.', 'warn');
      return;
    }

    localStorage.setItem('app_passcode', input);
    setAppPasscode(input);

    if (auth.currentUser) {
      try {
        await setDoc(doc(db, 'users', auth.currentUser.uid), { appPasscode: input }, { merge: true });
      } catch (e) {
        console.error("Error al persistir PIN en el servidor:", e);
      }
    }

    setShowSetupPasscodeModal(false);
    setSetupPasscoodeInput('');
    setSetupPasscodeConfirm('');
    showToast('Protección con clave de acceso activada correctamente.', 'success');
  };

  const handleConfirmClearPasscode = async () => {
    const input = clearPasscodeInput.trim();
    if (!input) {
      showToast('Debes ingresar tu clave actual para desactivar la seguridad.', 'warn');
      return;
    }
    if (input !== appPasscode) {
      showToast('La clave actual introducida es incorrecta.', 'warn');
      return;
    }

    localStorage.removeItem('app_passcode');
    setAppPasscode(null);
    setIsLocked(false);

    if (auth.currentUser) {
      try {
        await setDoc(doc(db, 'users', auth.currentUser.uid), { appPasscode: '' }, { merge: true });
      } catch (e) {
        console.error("Error al desactivar PIN en el servidor:", e);
      }
    }

    setClearPasscodeInput('');
    setShowClearPasscodeModal(false);
    showToast('Protección eliminada. Tu aplicación es de acceso libre ahora.', 'info');
  };

  // --- RESPALDOS Y BACKUPS (IMPORTACIÓN Y EXPORTACIÓN) ---
  const handleExportProfile = () => {
    const currentProfile = profiles.find(p => p.id === currentProfileId) || { id: currentProfileId, name: 'Perfil' };
    const backupObj = {
      backupType: 'profile-single',
      exportedAt: new Date().toISOString(),
      profile: currentProfile,
      data: {
        config,
        incomes,
        expenses,
        liabilities,
        transactions,
        realizedMovements,
        trash_bin: trashBin
      }
    };
    
    const blob = new Blob([JSON.stringify(backupObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeName = currentProfile.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    link.href = url;
    link.download = `respaldo_perfil_${safeName}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Guardando respaldo parcial de "${currentProfile.name}".`, 'success');
  };

  const handleExportAll = () => {
    const profilesData: Record<number, any> = {};
    profiles.forEach(p => {
      if (p.id === currentProfileId) {
        profilesData[p.id] = {
          config,
          incomes,
          expenses,
          liabilities,
          transactions,
          realizedMovements,
          trash_bin: trashBin
        };
      } else {
        const pKey = (k: string) => `profiles_data_${p.id}_${k}`;
        const loadOrFallback = (key: string, fallback: any) => {
          const val = localStorage.getItem(pKey(key));
          return val ? JSON.parse(val) : fallback;
        };
        profilesData[p.id] = {
          config: loadOrFallback('config', DEFAULT_CONFIG),
          incomes: loadOrFallback('incomes', []),
          expenses: loadOrFallback('expenses', []),
          liabilities: loadOrFallback('liabilities', []),
          transactions: loadOrFallback('transactions', []),
          realizedMovements: loadOrFallback('realizedMovements', []),
          trash_bin: loadOrFallback('trash_bin', [])
        };
      }
    });

    const backupObj = {
      backupType: 'system-all',
      exportedAt: new Date().toISOString(),
      profilesList: profiles,
      activeProfileId: currentProfileId,
      profilesData
    };

    const blob = new Blob([JSON.stringify(backupObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `respaldo_sistema_completo_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Respaldando todos los perfiles y movimientos.', 'success');
  };

  const handleImportTrigger = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);
        
        if (parsed.backupType === 'profile-single') {
          if (!parsed.profile || !parsed.data) {
            showToast('Formato de perfil inválido o incompleto.', 'warn');
            return;
          }
          setImportPendingData(parsed);
          setImportFileName(file.name);
          setImportOptionSingle('new_profile');
        } else if (parsed.backupType === 'system-all') {
          if (!Array.isArray(parsed.profilesList) || !parsed.profilesData) {
            showToast('Formato de base de datos completa inválido.', 'warn');
            return;
          }
          setImportPendingData(parsed);
          setImportFileName(file.name);
        } else {
          showToast('El archivo JSON no es un respaldo de Finanz.io válido.', 'warn');
        }
      } catch (err) {
        showToast('No se pudo decodificar el archivo JSON.', 'warn');
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmSystemImport = () => {
    if (!importPendingData) return;
    const bd = importPendingData;
    
    profiles.forEach(p => {
      localStorage.removeItem(`profiles_data_${p.id}_config`);
      localStorage.removeItem(`profiles_data_${p.id}_incomes`);
      localStorage.removeItem(`profiles_data_${p.id}_expenses`);
      localStorage.removeItem(`profiles_data_${p.id}_liabilities`);
      localStorage.removeItem(`profiles_data_${p.id}_transactions`);
      localStorage.removeItem(`profiles_data_${p.id}_realizedMovements`);
      localStorage.removeItem(`profiles_data_${p.id}_trash_bin`);
    });
    
    bd.profilesList.forEach((prof: Profile) => {
      const data = bd.profilesData[prof.id];
      if (data) {
        localStorage.setItem(`profiles_data_${prof.id}_config`, JSON.stringify(data.config));
        localStorage.setItem(`profiles_data_${prof.id}_incomes`, JSON.stringify(data.incomes));
        localStorage.setItem(`profiles_data_${prof.id}_expenses`, JSON.stringify(data.expenses));
        localStorage.setItem(`profiles_data_${prof.id}_liabilities`, JSON.stringify(data.liabilities));
        localStorage.setItem(`profiles_data_${prof.id}_transactions`, JSON.stringify(data.transactions));
        localStorage.setItem(`profiles_data_${prof.id}_realizedMovements`, JSON.stringify(data.realizedMovements || []));
        localStorage.setItem(`profiles_data_${prof.id}_trash_bin`, JSON.stringify(data.trash_bin || []));
      }
    });
    
    setProfiles(bd.profilesList);
    localStorage.setItem('profiles_list', JSON.stringify(bd.profilesList));
    
    const nextActiveId = bd.activeProfileId || bd.profilesList[0].id;
    setCurrentProfileId(nextActiveId);
    
    if (nextActiveId === currentProfileId) {
      const liveData = bd.profilesData[nextActiveId];
      if (liveData) {
        setConfig(liveData.config);
        setIncomes(liveData.incomes);
        setExpenses(liveData.expenses);
        setLiabilities(liveData.liabilities);
        setTransactions(liveData.transactions);
        setRealizedMovements(liveData.realizedMovements || []);
        setTrashBin(liveData.trash_bin || []);
      }
    }
    
    setImportPendingData(null);
    showToast('Base de datos y perfiles restaurados con éxito.', 'success');
  };

  const handleConfirmSingleProfileImport = () => {
    if (!importPendingData) return;
    const fileData = importPendingData;
    const backupProfile = fileData.profile;
    const backupPayload = fileData.data;
    
    if (importOptionSingle === 'new_profile') {
      const newId = profiles.length > 0 ? Math.max(...profiles.map(p => p.id)) + 1 : 1;
      const importedName = `${backupProfile.name} (Restaurado)`;
      const newProf: Profile = { id: newId, name: importedName };
      
      localStorage.setItem(`profiles_data_${newId}_config`, JSON.stringify(backupPayload.config));
      localStorage.setItem(`profiles_data_${newId}_incomes`, JSON.stringify(backupPayload.incomes));
      localStorage.setItem(`profiles_data_${newId}_expenses`, JSON.stringify(backupPayload.expenses));
      localStorage.setItem(`profiles_data_${newId}_liabilities`, JSON.stringify(backupPayload.liabilities));
      localStorage.setItem(`profiles_data_${newId}_transactions`, JSON.stringify(backupPayload.transactions));
      localStorage.setItem(`profiles_data_${newId}_realizedMovements`, JSON.stringify(backupPayload.realizedMovements || []));
      localStorage.setItem(`profiles_data_${newId}_trash_bin`, JSON.stringify(backupPayload.trash_bin || []));
      
      const updatedProfiles = [...profiles, newProf];
      setProfiles(updatedProfiles);
      localStorage.setItem('profiles_list', JSON.stringify(updatedProfiles));
      setCurrentProfileId(newId);
      
      showToast(`Perfil "${importedName}" importado de forma segura.`, 'success');
    } else {
      setConfig(backupPayload.config);
      setIncomes(backupPayload.incomes);
      setExpenses(backupPayload.expenses);
      setLiabilities(backupPayload.liabilities);
      setTransactions(backupPayload.transactions);
      setRealizedMovements(backupPayload.realizedMovements || []);
      setTrashBin(backupPayload.trash_bin || []);
      
      const pKey = (k: string) => `profiles_data_${currentProfileId}_${k}`;
      localStorage.setItem(pKey('config'), JSON.stringify(backupPayload.config));
      localStorage.setItem(pKey('incomes'), JSON.stringify(backupPayload.incomes));
      localStorage.setItem(pKey('expenses'), JSON.stringify(backupPayload.expenses));
      localStorage.setItem(pKey('liabilities'), JSON.stringify(backupPayload.liabilities));
      localStorage.setItem(pKey('transactions'), JSON.stringify(backupPayload.transactions));
      localStorage.setItem(pKey('realizedMovements'), JSON.stringify(backupPayload.realizedMovements || []));
      localStorage.setItem(pKey('trash_bin'), JSON.stringify(backupPayload.trash_bin || []));
      
      showToast(`Datos del perfil actual reemplazados exitosamente.`, 'success');
    }
    
    setImportPendingData(null);
  };

  // Responsive Navbar Drawer para móviles
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (isLocked) {
    return (
      <LockScreen
        correctPasscode={appPasscode || ''}
        onUnlock={() => {
          setIsLocked(false);
          showToast('Bienvenido de nuevo. Acceso autorizado.', 'success');
        }}
        onReset={() => {
          if (window.confirm('⚠️ ATENCIÓN: Esto restablecerá la aplicación por completo. Se eliminarán de forma permanente todos tus perfiles de presupuesto, deudas, transacciones y configuraciones específicas guardadas en este navegador (localStorage). ¿Deseas proceder?')) {
            localStorage.clear();
            window.location.reload();
          }
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors duration-300">
      
      {/* NO BACKGROUND GLOWS - PURE CLEAN COHESIVE SLATE CANVAS */}

      {/* TOAST NOTIFICATIONS DRAWER */}
      <div className="fixed bottom-5 right-5 flex flex-col gap-2 z-50 pointer-events-none max-w-sm w-[90%]">
        {toasts.map(t => {
          let color = 'bg-slate-900 border-slate-800 text-slate-100';
          if (t.type === 'success') color = 'bg-emerald-600 border-emerald-500 text-white';
          if (t.type === 'warn') color = 'bg-rose-600 border-rose-500 text-white';
          
          return (
            <div
              key={t.id}
              className={`p-3 rounded-xl border shadow-lg flex items-center gap-2 pointer-events-auto text-xs font-semibold animate-in slide-in-from-bottom-5 duration-200 ${color}`}
            >
              <span>{t.text}</span>
            </div>
          );
        })}
      </div>

      {/* HEADER / NAVIGATION BAR */}
      <header className="border-b border-slate-250 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md sticky top-0 z-40 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white shadow-sm">
              <Wallet size={16} />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white leading-none">
                Finanz.io
              </h1>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium tracking-wider uppercase block mt-1">
                Presupuesto y Proyección de Flujo
              </span>
            </div>
          </div>

          {/* Desktop Pestañas Navegación */}
          <nav className="hidden md:flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            {[
              { id: 'dashboard', label: 'Monitor', icon: <LayoutDashboard size={14} /> },
              { id: 'formularios', label: 'Planificación', icon: <Calendar size={14} /> },
              { id: 'cronograma', label: 'Cronograma Diario', icon: <Layers size={14} /> }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all select-none cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm border border-slate-200 dark:border-slate-800'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {/* Sincronización en la Nube con Google */}
            {isAuthLoading ? (
              <div className="w-5 h-5 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
            ) : user ? (
              <div className="flex items-center gap-2 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-1 pl-2 pr-2.5 rounded-full text-[11px] font-bold text-slate-600 dark:text-slate-300">
                {user.photoURL ? (
                  <img src={user.photoURL} referrerPolicy="no-referrer" className="w-5 h-5 rounded-full" alt="Profile" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[9px]">U</div>
                )}
                <span className="max-w-[70px] sm:max-w-[120px] truncate hidden sm:inline">{user.displayName || user.email}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title="Sincronizado en la Nube" />
                <button 
                  onClick={(e) => { e.stopPropagation(); handleGoogleLogout(); }}
                  title="Cerrar sesión"
                  className="ml-1 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <button
                onClick={handleGoogleLogin}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer hover:shadow hover:scale-[1.01]"
              >
                <Cloud size={14} />
                <span className="hidden xs:inline">Respaldar en Nube</span>
                <span className="xs:hidden">Nube</span>
              </button>
            )}

            {/* Tema Switcher */}
            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              title="Alternar tema"
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors pointer-events-auto cursor-pointer"
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 cursor-pointer"
            >
              <Menu size={16} />
            </button>
          </div>
        </div>

        {/* Mobile Menu Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-850 p-4 animate-in slide-in-from-top duration-200 flex flex-col gap-2 z-50 relative">
            {[
              { id: 'dashboard', label: 'Monitor', icon: <LayoutDashboard size={14} /> },
              { id: 'formularios', label: 'Planificación', icon: <Calendar size={14} /> },
              { id: 'cronograma', label: 'Cronograma Diario', icon: <Layers size={14} /> }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setMobileMenuOpen(false);
                }}
                className={`flex items-center gap-2 p-3 rounded-xl text-xs font-bold transition-all ${
                  activeTab === tab.id
                    ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-250'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        )}
      </header>

      {/* CUERPO PRINCIPAL DOS COLUMNAS RESPONSIVO */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 z-10 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          
          {/* Barra Lateral Izquierda (Perfiles, Alertas y Sugerencias) */}
          <div className="lg:col-span-1">
            <Sidebar
              profiles={profiles}
              currentProfileId={currentProfileId}
              onProfileChange={setCurrentProfileId}
              onAddProfile={() => setShowAddProfileModal(true)}
              onDeleteProfile={handleDeleteProfile}
              ledgerData={ledgerData}
              trashBin={trashBin}
              onEmptyTrash={handleEmptyTrash}
              onRestoreTrash={handleRestoreTrash}
              onScrollToRow={handleScrollToRow}
              onExportAll={handleExportAll}
              onExportProfile={handleExportProfile}
              onImportTrigger={handleImportTrigger}
              hasPasscode={!!appPasscode}
              onSetupPasscode={() => setShowSetupPasscodeModal(true)}
              onClearPasscode={() => setShowClearPasscodeModal(true)}
              onLockApp={() => {
                setIsLocked(true);
                showToast('La aplicación se ha bloqueado de forma inmediata.', 'info');
              }}
            />
          </div>

          {/* Panel Principal Derecho de la Pestaña Activa (SPA) */}
          <div className="lg:col-span-3 flex flex-col gap-6">
            {activeTab === 'dashboard' && (
              <Dashboard ledgerData={ledgerData} safetyMargin={Number(config.safety_margin)} />
            )}

            {activeTab === 'formularios' && (
              <FormManager
                config={config}
                onConfigSave={saveConfig}
                incomes={incomes}
                onIncomeAdd={handleAddIncome}
                onIncomeDelete={handleDeleteIncome}
                expenses={expenses}
                onExpenseAdd={handleAddExpense}
                onExpenseDelete={handleDeleteExpense}
                liabilities={liabilities}
                onLiabilityAdd={handleAddLiability}
                onLiabilityDelete={handleDeleteLiability}
                transactions={transactions}
                onTransactionAdd={handleAddTransaction}
                onTransactionDelete={handleDeleteTransaction}
                
                editingIncome={editingIncome}
                onCancelEditingIncome={() => setEditingIncome(null)}
                editingExpense={editingExpense}
                onCancelEditingExpense={() => setEditingExpense(null)}
                editingLiability={editingLiability}
                onCancelEditingLiability={() => setEditingLiability(null)}
                editingTransaction={editingTransaction}
                onCancelEditingTransaction={() => setEditingTransaction(null)}

                onStartEditIncome={setEditingIncome}
                onStartEditExpense={setEditingExpense}
                onStartEditLiability={setEditingLiability}
                onStartEditTransaction={setEditingTransaction}
              />
            )}

            {activeTab === 'cronograma' && (
              <Cronograma
                ledgerData={ledgerData}
                incomes={incomes}
                expenses={expenses}
                liabilities={liabilities}
                transactions={transactions}
                onDeleteIncome={handleDeleteIncome}
                onStartEditIncome={setEditingIncome}
                onDeleteExpense={handleDeleteExpense}
                onStartEditExpense={setEditingExpense}
                onDeleteLiability={handleDeleteLiability}
                onStartEditLiability={setEditingLiability}
                onDeleteTransaction={handleDeleteTransaction}
                onStartEditTransaction={setEditingTransaction}
                onConfirmRealizedStatus={handleConfirmRealizedStatus}
                onDeleteRealizedStatus={handleDeleteRealizedStatus}
              />
            )}
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/20 py-4 text-center mt-6 z-10">
        <div className="max-w-7xl mx-auto px-4 text-[10px] text-slate-400 dark:text-slate-500 font-medium">
          Control de Finanzas Proyectadas © {new Date().getFullYear()} • PWA Ready • Almacenamiento local aislado y seguro por perfiles.
        </div>
      </footer>

      {/* MODAL ELIMINAR PERFIL */}
      {showDeleteProfileModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl animate-in fade-in duration-200">
            <div className="w-10 h-10 bg-rose-100 dark:bg-rose-950/40 rounded-xl flex items-center justify-center text-rose-600 dark:text-rose-455 mb-3.5">
              <AlertTriangle size={20} />
            </div>

            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">
              ⚠️ Confirmar Eliminación Permanente
            </h3>
            <p className="text-[11.5px] text-slate-500 mb-4 leading-normal">
              ¿Estás completamente seguro de que deseas eliminar de forma irreversible el perfil de presupuesto actual <strong className="text-slate-800 dark:text-slate-200">"{profiles.find(p => p.id === currentProfileId)?.name}"</strong> junto con todos sus movimientos, deudas, transacciones y configuraciones específicas? Esta acción no se puede deshacer.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setShowDeleteProfileModal(false)}
                className="py-2.5 px-4 rounded-xl text-[11px] font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-pointer"
              >
                No, Cancelar
              </button>
              <button
                onClick={handleConfirmDeleteProfile}
                className="py-2.5 px-4 rounded-xl text-[11px] font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm cursor-pointer"
              >
                Sí, Eliminar de inmediato
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CREAR PERFIL (PORTAL POPUP) */}
      {showAddProfileModal && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl animate-in fade-in duration-200">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-2">
              👤 Crear Perfil de Presupuesto
            </h3>
            <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
              Crea perfiles aislados independientes para clasificar por separado tus presupuestos personales, de negocio o viajes.
            </p>

            <input
              type="text"
              placeholder="Ej. Mi Proyecto, Finanzas Familiares"
              value={newProfileName}
              onChange={e => setNewProfileName(e.target.value)}
              className="w-full text-xs rounded-xl py-2 px-3 bg-slate-50 dark:bg-slate-800 text-slate-850 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 mb-4"
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreateProfile();
              }}
            />

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setShowAddProfileModal(false);
                  setNewProfileName('');
                }}
                className="py-2 px-3 rounded-xl text-[11px] font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateProfile}
                className="py-2 px-4 rounded-xl text-[11px] font-bold bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm cursor-pointer"
              >
                Crear Perfil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAR IMPORTACIÓN */}
      {importPendingData && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-950/40 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-4">
              <Database size={20} />
            </div>

            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1.5">
              📥 Confirmar Restauración de Respaldo
            </h3>
            <p className="text-[11.5px] text-slate-500 mb-4 leading-normal">
              Estás a punto de importar el archivo <strong className="text-slate-800 dark:text-slate-100 font-mono font-medium">{importFileName}</strong> en el simulador de finanzas.
            </p>

            {importPendingData.backupType === 'profile-single' ? (
              <div className="space-y-4 mb-5">
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-150 dark:border-slate-800 rounded-xl">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Backup Detectado</span>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Solo Perfil Independiente: <span className="text-emerald-600 dark:text-emerald-400">"{importPendingData.profile?.name}"</span>
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">Exportado el: {new Date(importPendingData.exportedAt).toLocaleString()}</p>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Esquema de Destino</span>
                  
                  <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 bg-slate-50/20 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 cursor-pointer transition-all">
                    <input
                      type="radio"
                      name="import-option-single"
                      checked={importOptionSingle === 'new_profile'}
                      onChange={() => setImportOptionSingle('new_profile')}
                      className="mt-1 accent-emerald-500"
                    />
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Importar como un perfil totalmente nuevo</p>
                      <p className="text-[10.5px] text-slate-400 mt-0.5 leading-relaxed">Generará una nueva hoja de presupuesto aislada llamada "{importPendingData.profile?.name} (Restaurado)". Absolutamente seguro, no sobreescribe nada.</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-rose-500/50 bg-slate-50/20 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 cursor-pointer transition-all">
                    <input
                      type="radio"
                      name="import-option-single"
                      checked={importOptionSingle === 'replace_active'}
                      onChange={() => setImportOptionSingle('replace_active')}
                      className="mt-1 accent-rose-500"
                    />
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">Cargar y reemplazar en perfil activo</p>
                      <p className="text-[10.5px] text-slate-400 mt-0.5 leading-relaxed">Sobreescribirá y borrará para siempre todos los movimientos e ingresos del perfil que tienes seleccionado actualmente.</p>
                    </div>
                  </label>
                </div>
              </div>
            ) : (
              <div className="space-y-4 mb-5">
                <div className="p-3.5 bg-rose-50/50 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-905/30 rounded-xl text-xs text-rose-800 dark:text-rose-300">
                  <p className="font-bold flex items-center gap-1">⚠️ Peligro de Sobrescritura Completa</p>
                  <p className="mt-1 opacity-90 leading-relaxed text-[11px]">
                    Este archivo es un respaldo de todo el sistema. Restaurarlo reemplazará <strong>TODOS</strong> tus perfiles de presupuesto existentes ({profiles.length}) y cargará la configuración global desde el archivo. Esta operación no se puede deshacer.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-150 dark:border-slate-800 rounded-xl">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Backup Detectado</span>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Respaldo completo ({importPendingData.profilesList?.length || 0} perfiles)
                  </p>
                  <p className="text-[10px] text-slate-450 mt-1 font-medium font-mono">Exportado el: {new Date(importPendingData.exportedAt).toLocaleString()}</p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setImportPendingData(null)}
                className="py-2.5 px-4 rounded-xl text-[11px] font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-pointer"
              >
                Cancelar
              </button>
              {importPendingData.backupType === 'profile-single' ? (
                <button
                  onClick={handleConfirmSingleProfileImport}
                  className="py-2.5 px-5 rounded-xl text-[11px] font-bold bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm cursor-pointer"
                >
                  Restaurar Perfil
                </button>
              ) : (
                <button
                  onClick={handleConfirmSystemImport}
                  className="py-2.5 px-5 rounded-xl text-[11px] font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm cursor-pointer"
                >
                  Sobrescribir Todo
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIGURAR CLAVE/PIN DE SEGURIDAD */}
      {showSetupPasscodeModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl animate-in fade-in duration-200">
            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-950/40 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-450 mb-3.5">
              <KeyRound size={20} />
            </div>

            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">
              🔒 Configurar PIN o Clave de Acceso
            </h3>
            <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
              Establece una clave o PIN de acceso (letras o números) para proteger la visualización de tus datos financieros en este dispositivo.
            </p>

            <div className="space-y-3 mb-5">
              <div>
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 block mb-1">
                  Nueva Clave o PIN
                </label>
                <input
                  type="password"
                  value={setupPasscoodeInput}
                  onChange={e => setSetupPasscoodeInput(e.target.value)}
                  placeholder="Ej: 1234"
                  className="w-full text-slate-800 dark:text-white bg-slate-50 dark:bg-slate-800 border border-slate-250 dark:border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 block mb-1">
                  Confirmar Clave o PIN
                </label>
                <input
                  type="password"
                  value={setupPasscodeConfirm}
                  onChange={e => setSetupPasscodeConfirm(e.target.value)}
                  placeholder="Ej: 1234"
                  className="w-full text-slate-800 dark:text-white bg-slate-50 dark:bg-slate-800 border border-slate-250 dark:border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => {
                  setShowSetupPasscodeModal(false);
                  setSetupPasscoodeInput('');
                  setSetupPasscodeConfirm('');
                }}
                className="py-2.5 px-4 rounded-xl text-[11px] font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-405 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmSetupPasscode}
                className="py-2.5 px-5 rounded-xl text-[11px] font-bold bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm cursor-pointer"
              >
                Activar PIN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DESACTIVAR CLAVE/PIN DE SEGURIDAD */}
      {showClearPasscodeModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl animate-in fade-in duration-200">
            <div className="w-10 h-10 bg-rose-100 dark:bg-rose-950/40 rounded-xl flex items-center justify-center text-rose-600 dark:text-rose-400 mb-3.5">
              <Unlock size={20} />
            </div>

            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">
              🔓 Desactivar PIN o Clave de Acceso
            </h3>
            <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
              Ingresa tu clave de acceso actual para desactivar la seguridad y permitir el acceso libre a tus presupuestos.
            </p>

            <div className="mb-5">
              <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 block mb-1">
                Clave o PIN Actual
              </label>
              <input
                type="password"
                value={clearPasscodeInput}
                onChange={e => setClearPasscodeInput(e.target.value)}
                placeholder="Ingresa tu PIN actual"
                className="w-full text-slate-800 dark:text-white bg-slate-50 dark:bg-slate-800 border border-slate-250 dark:border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => {
                  setShowClearPasscodeModal(false);
                  setClearPasscodeInput('');
                }}
                className="py-2.5 px-4 rounded-xl text-[11px] font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-405 auto-pointer cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmClearPasscode}
                className="py-2.5 px-5 rounded-xl text-[11px] font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm cursor-pointer"
              >
                Desactivar Seguridad
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL CONFIGURACIÓN / SINCRONIZACIÓN MERGE CLOUD */}
      {showSyncMergeModal && (
        <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in duration-200">
            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-950/40 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3.5 animate-bounce">
              <Cloud size={20} />
            </div>

            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">
              ☁️ Sincronización en la Nube Finanz.io
            </h3>
            
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
              Has iniciado sesión correctamente. Para evitar pérdida o sobreescritura accidental de perfiles de presupuesto, por favor elige cómo deseas sincronizar tus datos por primera vez:
            </p>

            <div className="space-y-3 mb-5">
              {/* Opción 1: Subir Datos Locales */}
              <button
                disabled={isCloudSyncing}
                onClick={handleUploadLocalDataToCloud}
                className="w-full text-left p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 bg-slate-50/50 hover:bg-slate-50 dark:bg-slate-800/40 dark:hover:bg-slate-800 transition-all flex flex-col gap-1 cursor-pointer group"
              >
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 group-hover:translate-x-0.5 transition-transform">
                  Subir mi información local al servidor ↑
                </span>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Tomará los perfiles ({profiles.length}) de este dispositivo y los salvará en la nube bajo tu cuenta Google. Recomendado si tienes datos nuevos en este teléfono.
                </p>
              </button>

              {/* Opción 2: Descargar de la Nube */}
              {cloudProfilesList.length > 0 && (
                <button
                  disabled={isCloudSyncing}
                  onClick={handleDownloadCloudData}
                  className="w-full text-left p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-sky-500/50 bg-slate-50/50 hover:bg-slate-50 dark:bg-slate-800/40 dark:hover:bg-slate-800 transition-all flex flex-col gap-1 cursor-pointer group"
                >
                  <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400 flex items-center gap-1.5 group-hover:translate-x-0.5 transition-transform">
                    Descargar datos existentes desde la nube ↓
                  </span>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Descargará tus {cloudProfilesList.length} perfiles respaldados ({cloudProfilesList.map(p => `"${p.name}"`).join(', ')}) y reemplazará los datos actuales de este navegador. Útil si cambiaste de teléfono.
                  </p>
                </button>
              )}
            </div>

            <div className="flex items-center justify-end">
              <button
                disabled={isCloudSyncing}
                onClick={() => setShowSyncMergeModal(false)}
                className="py-2.5 px-4 rounded-xl text-[11px] font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-pointer disabled:opacity-50"
              >
                Decidir después
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
