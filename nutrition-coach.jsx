import React, { useReducer, useState, useEffect, useRef } from 'react';
import {
  Home, ShoppingBag, ChefHat, User, Upload, Plus, Trash2,
  Check, ChevronRight, ChevronDown, Clock, Flame, AlertCircle,
  Camera, Send, TrendingUp, Calendar, ShoppingCart, BarChart3, Zap,
  Heart, Droplets, Grid3x3, Copy, X
} from 'lucide-react';

// ============================================================================
// STORAGE HELPERS
// ============================================================================

const StorageAPI = {
  get: (key, fallback = null) => {
    try {
      const data = window.storage?.getItem(key);
      return data ? JSON.parse(data) : fallback;
    } catch {
      return fallback;
    }
  },
  set: (key, value) => {
    try {
      window.storage?.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Storage error:', e);
    }
  },
  clear: (key) => {
    try {
      window.storage?.removeItem(key);
    } catch (e) {
      console.error('Storage error:', e);
    }
  }
};

// ============================================================================
// CLAUDE API HELPERS
// ============================================================================

async function callClaude(messages) {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'API Error');
    }

    const data = await response.json();
    const text = data.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');

    return text;
  } catch (error) {
    throw new Error(`Claude API Error: ${error.message}`);
  }
}

function parseClaudeJson(text) {
  try {
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/({[\s\S]*})/);
    if (!jsonMatch) throw new Error('No JSON found');
    const jsonStr = jsonMatch[1] || jsonMatch[0];
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('JSON parse error:', e);
    throw new Error('Invalid response format');
  }
}

// ============================================================================
// UTILS
// ============================================================================

const calculateMacrosFromRecipes = (history) => {
  const thisWeek = history.filter(h => {
    const date = new Date(h.timestamp);
    const now = new Date();
    const daysAgo = (now - date) / (1000 * 60 * 60 * 24);
    return daysAgo <= 7;
  });

  const totals = thisWeek.reduce((acc, h) => ({
    kcal: acc.kcal + (h.macros?.kcal || 0),
    protein: acc.protein + (h.macros?.proteina_g || 0),
    carbs: acc.carbs + (h.macros?.carbos_g || 0),
    fats: acc.fats + (h.macros?.grasas_g || 0)
  }), { kcal: 0, protein: 0, carbs: 0, fats: 0 });

  return { totals, count: thisWeek.length };
};

const getTodayWater = () => {
  const today = new Date().toISOString().split('T')[0];
  const waterLog = StorageAPI.get('water:log', {});
  return waterLog[today] || 0;
};

const saveTodayWater = (amount) => {
  const today = new Date().toISOString().split('T')[0];
  const waterLog = StorageAPI.get('water:log', {});
  waterLog[today] = amount;
  StorageAPI.set('water:log', waterLog);
};

const getWeekWater = () => {
  const waterLog = StorageAPI.get('water:log', {});
  const weekData = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    weekData.push({
      date: dateStr,
      day: date.toLocaleDateString('es-ES', { weekday: 'short' }).slice(0, 3),
      amount: waterLog[dateStr] || 0
    });
  }
  return weekData;
};

// ============================================================================
// REUSABLE COMPONENTS
// ============================================================================

const EmptyState = ({ icon: Icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-12 px-4">
    <div className="mb-4 p-3 rounded-full bg-emerald-50">
      <Icon className="w-8 h-8 text-emerald-600" />
    </div>
    <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
    <p className="text-sm text-gray-500 text-center mb-6 max-w-xs">{description}</p>
    {action}
  </div>
);

const LoadingPulse = ({ label }) => (
  <div className="flex flex-col items-center justify-center py-12 px-4">
    <div className="relative w-12 h-12 mb-4">
      <div className="absolute inset-0 rounded-full bg-emerald-500 opacity-20 animate-pulse"></div>
      <div className="absolute inset-2 rounded-full bg-emerald-500 opacity-10 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
    </div>
    <p className="text-sm text-gray-600 font-medium">{label}</p>
  </div>
);

const Stepper = ({ steps, currentStep }) => (
  <div className="mb-6">
    <div className="flex items-center justify-between mb-3">
      {steps.map((step, idx) => (
        <React.Fragment key={idx}>
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
              idx < currentStep
                ? 'bg-emerald-600 text-white'
                : idx === currentStep
                ? 'bg-emerald-500 text-white'
                : 'bg-gray-200 text-gray-600'
            }`}
          >
            {idx < currentStep ? <Check size={16} /> : idx + 1}
          </div>
          {idx < steps.length - 1 && (
            <div
              className={`flex-1 h-1 mx-2 rounded-full transition-colors ${
                idx < currentStep ? 'bg-emerald-600' : 'bg-gray-200'
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
    <p className="text-xs text-gray-500 font-medium">{steps[currentStep]}</p>
  </div>
);

const TabBar = ({ current, onChange }) => {
  const tabs = [
    { id: 'home', label: 'Inicio', icon: Home },
    { id: 'pantry', label: 'Despensa', icon: ShoppingBag },
    { id: 'recipes', label: 'Recetas', icon: ChefHat },
    { id: 'profile', label: 'Perfil', icon: User }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 py-2 z-40">
      <div className="flex justify-around max-w-2xl mx-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`flex flex-col items-center py-2 px-3 rounded-lg transition-colors ${
              current === id
                ? 'text-emerald-600 bg-emerald-50'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Icon size={24} />
            <span className="text-xs font-medium mt-1">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

const PantryCard = ({ item, onDelete }) => (
  <div className="bg-white rounded-2xl p-4 border border-gray-100 flex items-start justify-between hover:shadow-md transition-shadow">
    <div className="flex-1">
      <p className="font-semibold text-gray-900">{item.name}</p>
      <p className="text-sm text-gray-500">{item.quantity} {item.unit}</p>
      <span className={`inline-block mt-2 text-xs font-semibold px-2 py-1 rounded-full ${
        item.category === 'proteina' ? 'bg-orange-100 text-orange-700' :
        item.category === 'carbohidrato' ? 'bg-amber-100 text-amber-700' :
        item.category === 'verdura' ? 'bg-emerald-100 text-emerald-700' :
        item.category === 'fruta' ? 'bg-pink-100 text-pink-700' :
        item.category === 'lacteo' ? 'bg-blue-100 text-blue-700' :
        item.category === 'grasa' ? 'bg-yellow-100 text-yellow-700' :
        'bg-gray-100 text-gray-700'
      }`}>
        {item.category}
      </span>
    </div>
    <button
      onClick={() => onDelete(item.name)}
      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
    >
      <Trash2 size={18} />
    </button>
  </div>
);

const RecipeCard = ({ recipe, onCook, userPantry, isFavorite, onToggleFavorite }) => {
  const hasMissingItems = recipe.ingredientes_faltan?.length > 0;

  return (
    <div className="bg-white rounded-3xl p-5 border border-gray-100 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 text-lg">{recipe.titulo}</h3>
          <p className="text-xs text-gray-500 mt-1">{recipe.encaje_objetivo}</p>
        </div>
        <button
          onClick={() => onToggleFavorite?.(recipe.titulo)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <Heart size={18} className={isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400'} />
        </button>
      </div>

      <div className="flex items-start justify-between mb-3">
        <span className={`text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap ${
          recipe.dificultad === 'fácil'
            ? 'bg-emerald-100 text-emerald-700'
            : recipe.dificultad === 'media'
            ? 'bg-amber-100 text-amber-700'
            : 'bg-red-100 text-red-700'
        }`}>
          {recipe.dificultad}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm text-gray-600 mb-4 bg-gray-50 rounded-2xl p-3">
        <div className="flex items-center gap-1">
          <Clock size={16} className="text-gray-400" />
          <span className="font-semibold">{recipe.tiempo_min}m</span>
        </div>
        <div className="flex items-center gap-1">
          <Flame size={16} className="text-orange-400" />
          <span className="font-semibold">{recipe.macros.kcal}kcal</span>
        </div>
        <div className="flex items-center gap-1">
          <Zap size={16} className="text-emerald-400" />
          <span className="font-semibold">{recipe.macros.proteina_g}p</span>
        </div>
      </div>

      <div className="bg-gray-50 rounded-2xl p-3 mb-4 text-xs text-gray-700 space-y-2 max-h-48 overflow-y-auto">
        {recipe.pasos.map((paso, idx) => (
          <div key={idx} className="flex gap-2">
            <span className="font-semibold text-gray-900 flex-shrink-0">{idx + 1}.</span>
            <span>{paso}</span>
          </div>
        ))}
      </div>

      {hasMissingItems && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-xs text-amber-700">
          <p className="font-semibold mb-2">Te falta:</p>
          <ul className="space-y-1">
            {recipe.ingredientes_faltan.map((ing, idx) => (
              <li key={idx}>• {ing.name} ({ing.quantity} {ing.unit})</li>
            ))}
          </ul>
        </div>
      )}

      <button
        onClick={() => onCook(recipe)}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl transition-colors"
      >
        {hasMissingItems ? 'Cocinar de todas formas' : 'Cocinar hoy'}
      </button>
    </div>
  );
};

const MacroBar = ({ value, max, color, label }) => (
  <div className="mb-4">
    <div className="flex justify-between items-baseline mb-2">
      <span className="text-sm font-semibold text-gray-900">{label}</span>
      <span className="text-xs text-gray-500">{Math.round(value)}/{max}g</span>
    </div>
    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${Math.min((value / max) * 100, 100)}%` }}
      />
    </div>
  </div>
);

const WaterTracker = ({ today, onAdd, onRemove }) => (
  <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-3xl p-5 text-white shadow-lg mb-6">
    <div className="flex items-start justify-between mb-4">
      <div>
        <p className="text-blue-100 text-xs font-medium">Hidratación hoy</p>
        <p className="text-4xl font-bold mt-2">{today}</p>
        <p className="text-blue-100 text-xs mt-1">de 8 vasos</p>
      </div>
      <Droplets size={40} className="opacity-20" />
    </div>

    <div className="flex gap-2">
      <button
        onClick={() => onAdd()}
        className="flex-1 bg-white/20 hover:bg-white/30 text-white font-semibold py-2 rounded-lg transition-colors text-sm"
      >
        + Vaso
      </button>
      <button
        onClick={() => onRemove()}
        disabled={today === 0}
        className="flex-1 bg-white/20 hover:bg-white/30 disabled:opacity-50 text-white font-semibold py-2 rounded-lg transition-colors text-sm"
      >
        - Vaso
      </button>
    </div>

    <div className="mt-3 w-full bg-white/20 rounded-full h-3 overflow-hidden">
      <div
        className="h-full bg-white rounded-full transition-all"
        style={{ width: `${Math.min((today / 8) * 100, 100)}%` }}
      />
    </div>
  </div>
);

const MealPrepModal = ({ recipes, onSelect, onClose }) => {
  const [weekPlan, setWeekPlan] = useState(StorageAPI.get('mealprep:plan', {}));
  const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  const handleSelectRecipe = (day, recipe) => {
    const updated = { ...weekPlan, [day]: recipe };
    setWeekPlan(updated);
    StorageAPI.set('mealprep:plan', updated);
  };

  const getTotalMacros = () => {
    return Object.values(weekPlan).reduce((acc, recipe) => {
      if (!recipe?.macros) return acc;
      return {
        kcal: acc.kcal + recipe.macros.kcal,
        protein: acc.protein + recipe.macros.proteina_g,
        carbs: acc.carbs + recipe.macros.carbos_g,
        fats: acc.fats + recipe.macros.grasas_g
      };
    }, { kcal: 0, protein: 0, carbs: 0, fats: 0 });
  };

  const macros = getTotalMacros();

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Planificador semanal</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 mb-6">
          {days.map(day => (
            <div key={day} className="border border-gray-200 rounded-xl p-4">
              <p className="font-semibold text-gray-900 mb-3">{day}</p>
              {weekPlan[day] ? (
                <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                  <p className="font-medium text-emerald-700">{weekPlan[day].titulo}</p>
                  <p className="text-xs text-emerald-600 mt-1">
                    {weekPlan[day].macros.kcal}kcal • {weekPlan[day].macros.proteina_g}g prot
                  </p>
                  <button
                    onClick={() => handleSelectRecipe(day, null)}
                    className="text-xs text-emerald-600 underline mt-2 font-medium"
                  >
                    Cambiar
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {recipes.map((recipe, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectRecipe(day, recipe)}
                      className="w-full text-left bg-gray-50 hover:bg-gray-100 p-2 rounded-lg transition-colors text-sm"
                    >
                      <p className="font-medium text-gray-900">{recipe.titulo}</p>
                      <p className="text-xs text-gray-500">{recipe.macros.kcal}kcal</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 mb-6">
          <p className="text-xs text-gray-500 font-semibold uppercase mb-3">Totales semanales</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-2xl font-bold text-gray-900">{Math.round(macros.kcal)}</p>
              <p className="text-xs text-gray-600">kcal</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-500">{Math.round(macros.protein)}</p>
              <p className="text-xs text-gray-600">g proteína</p>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// ONBOARDING COMPONENT
// ============================================================================

const OnboardingFlow = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState({
    age: '',
    weight: '',
    height: '',
    activityLevel: 'moderado',
    sleep: '7',
    profession: '',
    trainingType: 'hibrido',
    trainingFrequency: '3',
    trainingDuration: '45',
    trainingTime: 'manana',
    goals: [],
    customGoals: '',
    restrictions: []
  });

  const steps = [
    'Estilo de vida',
    'Entrenamiento',
    'Objetivos',
    'Restricciones'
  ];

  const restrictions = [
    'Sin gluten',
    'Vegetariano',
    'Vegano',
    'Sin lactosa',
    'Sin frutos secos',
    'Bajo sodio'
  ];

  const goals = [
    'Perder grasa',
    'Ganar músculo',
    'Recomposición',
    'Rendimiento deportivo',
    'Salud general'
  ];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      StorageAPI.set('profile:user', profile);
      onComplete();
    }
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Edad</label>
              <input
                type="number"
                value={profile.age}
                onChange={(e) => setProfile({ ...profile, age: e.target.value })}
                className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="25"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Peso (kg)</label>
                <input
                  type="number"
                  value={profile.weight}
                  onChange={(e) => setProfile({ ...profile, weight: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="70"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Altura (cm)</label>
                <input
                  type="number"
                  value={profile.height}
                  onChange={(e) => setProfile({ ...profile, height: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="180"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Nivel de actividad</label>
              <select
                value={profile.activityLevel}
                onChange={(e) => setProfile({ ...profile, activityLevel: e.target.value })}
                className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="sedentario">Sedentario</option>
                <option value="ligero">Ligero (1-3 días/semana)</option>
                <option value="moderado">Moderado (3-5 días/semana)</option>
                <option value="intenso">Intenso (5+ días/semana)</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Horas de sueño</label>
                <input
                  type="number"
                  value={profile.sleep}
                  onChange={(e) => setProfile({ ...profile, sleep: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="7"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Profesión</label>
                <input
                  type="text"
                  value={profile.profession}
                  onChange={(e) => setProfile({ ...profile, profession: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="e.g. Ingeniero"
                />
              </div>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Tipo de entrenamiento</label>
              <select
                value={profile.trainingType}
                onChange={(e) => setProfile({ ...profile, trainingType: e.target.value })}
                className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="fuerza">Fuerza</option>
                <option value="cardio">Cardio</option>
                <option value="hibrido">Híbrido</option>
                <option value="deporte">Deporte específico</option>
                <option value="ninguno">No entreno regularmente</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Frecuencia (días/sem)</label>
                <input
                  type="number"
                  value={profile.trainingFrequency}
                  onChange={(e) => setProfile({ ...profile, trainingFrequency: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="3"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Duración (minutos)</label>
                <input
                  type="number"
                  value={profile.trainingDuration}
                  onChange={(e) => setProfile({ ...profile, trainingDuration: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="45"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Momento del día</label>
              <select
                value={profile.trainingTime}
                onChange={(e) => setProfile({ ...profile, trainingTime: e.target.value })}
                className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="manana">Por la mañana</option>
                <option value="tarde">Por la tarde</option>
                <option value="noche">Por la noche</option>
              </select>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Tus objetivos</label>
              <div className="space-y-2">
                {goals.map((goal) => (
                  <button
                    key={goal}
                    onClick={() => {
                      const updated = profile.goals.includes(goal)
                        ? profile.goals.filter((g) => g !== goal)
                        : [...profile.goals, goal];
                      setProfile({ ...profile, goals: updated });
                    }}
                    className={`w-full text-left px-4 py-3 rounded-xl border-2 font-medium transition-colors ${
                      profile.goals.includes(goal)
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                        : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {profile.goals.includes(goal) && <Check size={18} className="inline mr-2" />}
                    {goal}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Algo más que añadir</label>
              <textarea
                value={profile.customGoals}
                onChange={(e) => setProfile({ ...profile, customGoals: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                placeholder="e.g. Mejorar mi piel, tener más energía..."
                rows={3}
              />
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Restricciones y preferencias</label>
              <div className="flex flex-wrap gap-2">
                {restrictions.map((restriction) => (
                  <button
                    key={restriction}
                    onClick={() => {
                      const updated = profile.restrictions.includes(restriction)
                        ? profile.restrictions.filter((r) => r !== restriction)
                        : [...profile.restrictions, restriction];
                      setProfile({ ...profile, restrictions: updated });
                    }}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      profile.restrictions.includes(restriction)
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {restriction}
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-sm text-emerald-700">
              <p className="font-semibold mb-1">¡Casi listo!</p>
              <p>Tu perfil está completo. Presiona "Comenzar" para empezar a gestionar tu despensa.</p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-orange-50 px-4 py-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Coach Nutricional</h1>
          <p className="text-gray-600 mt-2">Vamos a conocerte un poco</p>
        </div>

        <Stepper steps={steps} currentStep={step} />

        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-6">
          {renderStep()}
        </div>

        <div className="flex gap-3">
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-900 font-semibold hover:bg-gray-50 transition-colors"
            >
              Atrás
            </button>
          )}
          <button
            onClick={handleNext}
            className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors"
          >
            {step === steps.length - 1 ? 'Comenzar' : 'Siguiente'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// STATE REDUCER
// ============================================================================

const initialState = {
  pantry: [],
  recipes: [],
  history: [],
  ticketsProcessed: [],
  favorites: [],
  loading: false,
  error: null
};

const appReducer = (state, action) => {
  switch (action.type) {
    case 'SET_PANTRY':
      return { ...state, pantry: action.payload };
    case 'ADD_PANTRY_ITEMS': {
      const updated = [...state.pantry];
      action.payload.forEach((newItem) => {
        const existing = updated.find((item) => item.name.toLowerCase() === newItem.name.toLowerCase());
        if (existing) {
          existing.quantity += newItem.quantity;
        } else {
          updated.push(newItem);
        }
      });
      StorageAPI.set('pantry:items', updated);
      return { ...state, pantry: updated };
    }
    case 'REMOVE_PANTRY_ITEM': {
      const updated = state.pantry.filter((item) => item.name !== action.payload);
      StorageAPI.set('pantry:items', updated);
      return { ...state, pantry: updated };
    }
    case 'USE_RECIPE_ITEMS': {
      const updated = state.pantry.map((item) => {
        const usedAmount = action.payload.find(
          (ing) => ing.name.toLowerCase() === item.name.toLowerCase()
        );
        if (usedAmount) {
          return { ...item, quantity: Math.max(0, item.quantity - usedAmount.quantity) };
        }
        return item;
      }).filter((item) => item.quantity > 0);

      const history = [
        {
          timestamp: new Date().toISOString(),
          recipe: action.recipe.titulo,
          macros: action.recipe.macros
        },
        ...state.history
      ];

      StorageAPI.set('pantry:items', updated);
      StorageAPI.set('history:recipes', history);
      return { ...state, pantry: updated, history };
    }
    case 'SET_RECIPES':
      return { ...state, recipes: action.payload };
    case 'TOGGLE_FAVORITE': {
      const isFav = state.favorites.includes(action.payload);
      const updated = isFav
        ? state.favorites.filter(f => f !== action.payload)
        : [...state.favorites, action.payload];
      StorageAPI.set('favorites:recipes', updated);
      return { ...state, favorites: updated };
    }
    case 'SET_FAVORITES':
      return { ...state, favorites: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload, error: null };
    case 'SET_ERROR':
      return { ...state, loading: false, error: action.payload };
    case 'SET_HISTORY':
      return { ...state, history: action.payload };
    default:
      return state;
  }
};

// ============================================================================
// SHOPPING LIST COMPONENT
// ============================================================================

const ShoppingListModal = ({ recipes, pantry, onClose, onBuy }) => {
  const getShoppingList = () => {
    const needed = {};

    recipes.forEach(recipe => {
      recipe.ingredientes_faltan?.forEach(item => {
        const key = item.name.toLowerCase();
        if (!needed[key]) {
          needed[key] = { ...item, recipes: [] };
        }
        needed[key].recipes.push(recipe.titulo);
      });
    });

    return Object.values(needed);
  };

  const list = getShoppingList();

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Lista de compra</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            ✕
          </button>
        </div>

        {list.length === 0 ? (
          <p className="text-center text-gray-500 py-8">Tienes todo lo que necesitas</p>
        ) : (
          <div className="space-y-3 mb-6">
            {list.map((item, idx) => (
              <div key={idx} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{item.name}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {item.quantity} {item.unit}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Para: {item.recipes.join(', ')}
                    </p>
                  </div>
                  <button
                    onClick={() => onBuy(item)}
                    className="p-2 rounded-lg hover:bg-emerald-100 text-emerald-600 transition-colors"
                  >
                    <Check size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-gray-100 text-gray-900 font-semibold hover:bg-gray-200 transition-colors"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN APP
// ============================================================================

export default function PantryApp() {
  const [tab, setTab] = useState('home');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showShoppingList, setShowShoppingList] = useState(false);
  const [showMealPrep, setShowMealPrep] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [profile, setProfile] = useState(null);
  const [waterToday, setWaterToday] = useState(getTodayWater());
  const fileInputRef = useRef(null);

  // Load from storage
  useEffect(() => {
    const savedProfile = StorageAPI.get('profile:user');
    const savedPantry = StorageAPI.get('pantry:items', []);
    const savedHistory = StorageAPI.get('history:recipes', []);
    const savedFavorites = StorageAPI.get('favorites:recipes', []);

    if (!savedProfile) {
      setShowOnboarding(true);
    } else {
      setProfile(savedProfile);
    }

    dispatch({ type: 'SET_PANTRY', payload: savedPantry });
    dispatch({ type: 'SET_HISTORY', payload: savedHistory });
    dispatch({ type: 'SET_FAVORITES', payload: savedFavorites });
  }, []);

  const handleProfileComplete = () => {
    const savedProfile = StorageAPI.get('profile:user');
    setProfile(savedProfile);
    setShowOnboarding(false);
  };

  // =========================================================================
  // UPLOAD TICKET
  // =========================================================================

  const handleTicketUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result.split(',')[1];
        const mediaType = file.type || 'image/jpeg';

        const prompt = `Analiza este ticket de compra y extrae SOLO los ingredientes alimentarios.
Responde ÚNICAMENTE en JSON válido, sin markdown, sin texto extra. Formato exacto:
{
  "items": [
    { "name": "nombre del ingrediente", "quantity": número, "unit": "kg/l/unidad", "category": "proteina|carbohidrato|verdura|fruta|lacteo|grasa|otro" }
  ]
}`;

        const messages = [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64
                }
              },
              {
                type: 'text',
                text: prompt
              }
            ]
          }
        ];

        const response = await callClaude(messages);
        const parsed = parseClaudeJson(response);

        dispatch({ type: 'ADD_PANTRY_ITEMS', payload: parsed.items });

        const tickets = StorageAPI.get('history:tickets', []);
        tickets.unshift({
          date: new Date().toISOString(),
          itemsCount: parsed.items.length,
          items: parsed.items.map((i) => i.name).join(', ')
        });
        StorageAPI.set('history:tickets', tickets);

        dispatch({ type: 'SET_LOADING', payload: false });
        setTab('pantry');
      };
      reader.readAsDataURL(file);
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // =========================================================================
  // GENERATE RECIPES
  // =========================================================================

  const generateRecipes = async () => {
    if (!profile || state.pantry.length === 0) {
      dispatch({ type: 'SET_ERROR', payload: 'Necesitas perfil y despensa para generar recetas' });
      return;
    }

    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      const pantryStr = state.pantry
        .map((item) => `${item.name} (${item.quantity}${item.unit})`)
        .join(', ');

      const prompt = `Eres un chef nutricionista personalizado. Basándote en:
- Perfil: ${profile.age} años, ${profile.weight}kg, ${profile.height}cm, actividad ${profile.activityLevel}
- Objetivos: ${profile.goals.join(', ') || 'salud general'}
- Restricciones: ${profile.restrictions.join(', ') || 'ninguna'}
- Despensa actual: ${pantryStr}

Genera EXACTAMENTE 3 recetas que:
1. Usen ingredientes que ya tiene
2. Encajen con sus objetivos nutricionales
3. Sean realizables en 30-60 minutos
4. Tengan macros equilibradas

Responde ÚNICAMENTE en JSON válido, sin markdown:
{
  "recetas": [
    {
      "titulo": "nombre corto",
      "tiempo_min": 30,
      "dificultad": "fácil|media|alta",
      "macros": { "kcal": 0, "proteina_g": 0, "carbos_g": 0, "grasas_g": 0 },
      "ingredientes_usados": [{ "name": "...", "quantity": 0, "unit": "..." }],
      "ingredientes_faltan": [{ "name": "...", "quantity": 0, "unit": "..." }],
      "pasos": ["paso 1", "paso 2", ...],
      "encaje_objetivo": "frase corta de por qué encaja"
    }
  ]
}`;

      const response = await callClaude([{ role: 'user', content: prompt }]);
      const parsed = parseClaudeJson(response);

      dispatch({ type: 'SET_RECIPES', payload: parsed.recetas });
      dispatch({ type: 'SET_LOADING', payload: false });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const handleCookRecipe = (recipe) => {
    dispatch({ type: 'USE_RECIPE_ITEMS', payload: recipe.ingredientes_usados, recipe });
  };

  if (showOnboarding && !profile) {
    return <OnboardingFlow onComplete={handleProfileComplete} />;
  }

  const { totals, count } = calculateMacrosFromRecipes(state.history);

  // =========================================================================
  // HOME TAB
  // =========================================================================

  const HomeTab = () => (
    <div className="pb-24 px-4 pt-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Hola 👋</h1>
          <p className="text-gray-600 mt-1">
            {profile?.age ? `${profile.age} años • ${profile.weight}kg • ${profile.goals?.[0] || 'salud general'}` : ''}
          </p>
        </div>

        <WaterTracker
          today={waterToday}
          onAdd={() => {
            const newAmount = waterToday + 1;
            setWaterToday(newAmount);
            saveTodayWater(newAmount);
          }}
          onRemove={() => {
            if (waterToday > 0) {
              const newAmount = waterToday - 1;
              setWaterToday(newAmount);
              saveTodayWater(newAmount);
            }
          }}
        />

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-3xl p-5 text-white shadow-lg">
            <ShoppingBag size={32} className="opacity-20 mb-3" />
            <p className="text-emerald-100 text-xs font-medium">Despensa</p>
            <p className="text-3xl font-bold mt-1">{state.pantry.length}</p>
            <p className="text-emerald-100 text-xs mt-1">ingredientes</p>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-3xl p-5 text-white shadow-lg">
            <TrendingUp size={32} className="opacity-20 mb-3" />
            <p className="text-orange-100 text-xs font-medium">Esta semana</p>
            <p className="text-3xl font-bold mt-1">{count}</p>
            <p className="text-orange-100 text-xs mt-1">recetas</p>
          </div>
        </div>

        {state.history.length > 0 && (
          <div className="bg-white rounded-3xl p-5 border border-gray-100 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Macros esta semana</h3>
              <BarChart3 size={18} className="text-gray-400" />
            </div>
            <MacroBar value={totals.protein} max={profile?.weight ? parseInt(profile.weight) * 1.6 : 100} color="bg-orange-500" label="Proteína" />
            <MacroBar value={totals.carbs} max={250} color="bg-amber-500" label="Carbohidratos" />
            <MacroBar value={totals.fats} max={80} color="bg-yellow-500" label="Grasas" />
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-gray-900">{Math.round(totals.kcal)}</span> kcal totales
              </p>
            </div>
          </div>
        )}

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={state.loading}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-4 rounded-2xl flex items-center justify-center gap-2 transition-colors shadow-md mb-3"
        >
          <Camera size={20} />
          {state.loading ? 'Leyendo ticket...' : 'Subir ticket de compra'}
        </button>

        <button
          onClick={generateRecipes}
          disabled={state.loading || state.pantry.length === 0}
          className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-4 rounded-2xl flex items-center justify-center gap-2 transition-colors shadow-md mb-3"
        >
          <ChefHat size={20} />
          {state.loading ? 'Buscando recetas...' : '¿Qué cocino hoy?'}
        </button>

        <button
          onClick={() => setShowMealPrep(true)}
          disabled={state.recipes.length === 0}
          className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-4 rounded-2xl flex items-center justify-center gap-2 transition-colors shadow-md mb-6"
        >
          <Grid3x3 size={20} />
          Planificador semanal
        </button>

        {state.recipes.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Recetas sugeridas</h2>
              <button
                onClick={() => setShowShoppingList(true)}
                className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-3 py-1 rounded-full hover:bg-emerald-200 transition-colors flex items-center gap-1"
              >
                <ShoppingCart size={14} />
                Compra
              </button>
            </div>
            <div className="space-y-3">
              {state.recipes.slice(0, 2).map((recipe, idx) => (
                <div key={idx} className="bg-white rounded-2xl p-4 border border-gray-100">
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-semibold text-gray-900">{recipe.titulo}</p>
                    <button
                      onClick={() => dispatch({ type: 'TOGGLE_FAVORITE', payload: recipe.titulo })}
                      className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Heart size={16} className={state.favorites.includes(recipe.titulo) ? 'fill-red-500 text-red-500' : 'text-gray-400'} />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">{recipe.encaje_objetivo}</p>
                  <div className="flex gap-2 text-xs text-gray-600 mt-2 mb-3">
                    <span>⏱ {recipe.tiempo_min}m</span>
                    <span>🔥 {recipe.macros.kcal}kcal</span>
                  </div>
                  <button
                    onClick={() => handleCookRecipe(recipe)}
                    className="w-full bg-emerald-100 text-emerald-700 font-semibold py-2 rounded-lg hover:bg-emerald-200 transition-colors text-sm"
                  >
                    Cocinar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {state.error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex gap-3">
            <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-900 text-sm">{state.error}</p>
              <button
                onClick={() => generateRecipes()}
                className="text-xs text-red-700 underline mt-2 font-medium"
              >
                Reintentar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // =========================================================================
  // PANTRY TAB
  // =========================================================================

  const PantryTab = () => (
    <div className="pb-24 px-4 pt-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Mi Despensa</h2>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={state.loading}
            className="p-2 rounded-lg bg-emerald-100 text-emerald-600 hover:bg-emerald-200 transition-colors disabled:opacity-50"
          >
            <Plus size={20} />
          </button>
        </div>

        {state.pantry.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="Despensa vacía"
            description="Sube fotos de tus tickets de compra para empezar a gestionar tus ingredientes"
            action={
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors"
              >
                Subir primer ticket
              </button>
            }
          />
        ) : (
          <div className="space-y-3">
            {state.pantry.map((item) => (
              <PantryCard
                key={item.name}
                item={item}
                onDelete={(name) => dispatch({ type: 'REMOVE_PANTRY_ITEM', payload: name })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // =========================================================================
  // RECIPES TAB
  // =========================================================================

  const RecipesTab = () => {
    const displayRecipes = showFavoritesOnly
      ? state.recipes.filter(r => state.favorites.includes(r.titulo))
      : state.recipes;

    return (
      <div className="pb-24 px-4 pt-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Recetas</h2>
            {state.recipes.length > 0 && (
              <button
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                className={`p-2 rounded-lg transition-colors ${
                  showFavoritesOnly
                    ? 'bg-red-100 text-red-600'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Heart size={20} className={showFavoritesOnly ? 'fill-current' : ''} />
              </button>
            )}
          </div>

          {state.loading ? (
            <LoadingPulse label="Buscando recetas que encajen contigo…" />
          ) : state.recipes.length === 0 ? (
            <EmptyState
              icon={ChefHat}
              title="Sin recetas aún"
              description="Genera recetas personalizadas basadas en tu despensa y objetivos"
              action={
                <button
                  onClick={generateRecipes}
                  disabled={state.pantry.length === 0}
                  className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  Generar recetas
                </button>
              }
            />
          ) : displayRecipes.length === 0 ? (
            <EmptyState
              icon={Heart}
              title="Sin favoritas aún"
              description="Marca las recetas que te gusten con el corazón"
              action={
                <button
                  onClick={() => setShowFavoritesOnly(false)}
                  className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors"
                >
                  Ver todas
                </button>
              }
            />
          ) : (
            <div className="space-y-4">
              {displayRecipes.map((recipe, idx) => (
                <RecipeCard
                  key={idx}
                  recipe={recipe}
                  onCook={handleCookRecipe}
                  isFavorite={state.favorites.includes(recipe.titulo)}
                  onToggleFavorite={(title) => dispatch({ type: 'TOGGLE_FAVORITE', payload: title })}
                />
              ))}
              <button
                onClick={generateRecipes}
                className="w-full py-3 rounded-xl border-2 border-emerald-600 text-emerald-600 font-semibold hover:bg-emerald-50 transition-colors mt-6"
              >
                Generar nuevas recetas
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // =========================================================================
  // PROFILE TAB
  // =========================================================================

  const ProfileTab = () => (
    <div className="pb-24 px-4 pt-6">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Mi Perfil</h2>

        {profile && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-4 border border-gray-100">
              <p className="text-xs text-gray-500 font-semibold uppercase">Datos personales</p>
              <p className="text-gray-900 font-semibold mt-2">{profile.age} años • {profile.weight}kg • {profile.height}cm</p>
              <p className="text-sm text-gray-600 mt-1">Sueño: {profile.sleep}h • Actividad: {profile.activityLevel}</p>
              {profile.profession && <p className="text-sm text-gray-600">Profesión: {profile.profession}</p>}
            </div>

            <div className="bg-white rounded-2xl p-4 border border-gray-100">
              <p className="text-xs text-gray-500 font-semibold uppercase">Entrenamiento</p>
              <p className="text-gray-900 font-semibold mt-2">{profile.trainingType}</p>
              <p className="text-sm text-gray-600 mt-1">{profile.trainingFrequency}x/semana • {profile.trainingDuration} min • {profile.trainingTime}</p>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-gray-100">
              <p className="text-xs text-gray-500 font-semibold uppercase">Objetivos</p>
              <div className="flex flex-wrap gap-2 mt-3">
                {profile.goals.map((goal) => (
                  <span key={goal} className="bg-emerald-100 text-emerald-700 text-xs px-3 py-1 rounded-full font-medium">
                    {goal}
                  </span>
                ))}
              </div>
              {profile.customGoals && <p className="text-sm text-gray-600 mt-3">"{profile.customGoals}"</p>}
            </div>

            {profile.restrictions.length > 0 && (
              <div className="bg-white rounded-2xl p-4 border border-gray-100">
                <p className="text-xs text-gray-500 font-semibold uppercase">Restricciones</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {profile.restrictions.map((r) => (
                    <span key={r} className="bg-orange-100 text-orange-700 text-xs px-3 py-1 rounded-full font-medium">
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {state.history.length > 0 && (
              <div className="bg-white rounded-2xl p-4 border border-gray-100">
                <p className="text-xs text-gray-500 font-semibold uppercase mb-3">Historial (últimas recetas)</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {state.history.slice(0, 5).map((h, idx) => (
                    <div key={idx} className="flex items-start gap-2 pb-2 border-b border-gray-100 last:border-0">
                      <Check size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{h.recipe}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(h.timestamp).toLocaleDateString('es-ES')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => {
                StorageAPI.clear('profile:user');
                StorageAPI.clear('pantry:items');
                StorageAPI.clear('history:recipes');
                StorageAPI.clear('favorites:recipes');
                StorageAPI.clear('water:log');
                StorageAPI.clear('mealprep:plan');
                setShowOnboarding(true);
              }}
              className="w-full mt-6 py-3 rounded-xl border border-red-200 text-red-600 font-semibold hover:bg-red-50 transition-colors"
            >
              Resetear todo
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div className="min-h-screen bg-gray-50">
      {tab === 'home' && <HomeTab />}
      {tab === 'pantry' && <PantryTab />}
      {tab === 'recipes' && <RecipesTab />}
      {tab === 'profile' && <ProfileTab />}

      {showShoppingList && (
        <ShoppingListModal
          recipes={state.recipes}
          pantry={state.pantry}
          onClose={() => setShowShoppingList(false)}
          onBuy={(item) => {
            dispatch({
              type: 'ADD_PANTRY_ITEMS',
              payload: [item]
            });
          }}
        />
      )}

      {showMealPrep && (
        <MealPrepModal
          recipes={state.recipes}
          onSelect={() => {}}
          onClose={() => setShowMealPrep(false)}
        />
      )}

      <TabBar current={tab} onChange={setTab} />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleTicketUpload}
        className="hidden"
        capture="environment"
      />
    </div>
  );
}