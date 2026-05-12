# 🥗 Nutrition Coach - React Artifact

Una aplicación completa de coaching nutricional construida con React, integrada con Claude AI para recomendaciones personalizadas.

## 🚀 Características Principales

### 📋 Recetas Inteligentes
- Generación automática de recetas con IA
- Análisis de macronutrientes
- Filtrado por objetivos nutricionales
- Compartir y guardar favoritas

### 📊 Seguimiento de Nutrición
- Registro diario de macros
- Análisis nutricional avanzado
- Tendencias semanales y mensuales
- Visualización de progreso

### ⚖️ Seguimiento de Peso
- Histórico de peso
- Gráficos de tendencia
- Metas de peso personalizadas
- Proyecciones de progreso

### 🍽️ Planificación de Comidas
- Planificador semanal inteligente
- Prep de comidas sugeridas
- Listas de compra automáticas
- Sugerencias basadas en preferencias

### 💪 Entrenamientos
- Registro de entrenamientos
- Análisis de fitness
- Sincronización con aplicaciones de salud
- Seguimiento de objetivos

### 💧 Bienestar
- Seguimiento de agua
- Recordatorios diarios
- Análisis de hidratación
- Notificaciones personalizadas

### 💰 Análisis Financiero
- Seguimiento de gastos en comida
- Análisis de costos
- Estadísticas por comida
- Reportes de gasto

## ⚙️ Configuración Necesaria

### API Key de Claude
Para usar las funciones de IA, necesitas una API key de Anthropic:

1. Ve a https://console.anthropic.com/
2. Crea una cuenta y obtén tu API key
3. La aplicación pedirá el API key cuando sea necesario

### Dependencias
```bash
npm install react lucide-react
```

## 📁 Archivos

- `nutrition-coach.jsx` - Componente principal con toda la lógica
- `artifact.jsx` - Punto de entrada del artifact
- `README.md` - Esta documentación

## 🎯 Uso

```jsx
import PantryApp from './nutrition-coach.jsx';

export default function App() {
  return <PantryApp />;
}
```

## 🎨 Características del UI

- **Diseño responsivo** adaptado a móvil y escritorio
- **Tab navigation** con 4 pestañas principales:
  - Home: Resumen y acciones rápidas
  - Recetas: Generación y descubrimiento
  - Pantry: Gestión de ingredientes
  - Perfil: Configuración y datos personales

## 🔐 Privacidad

Todos los datos se almacenan localmente en el navegador usando localStorage.

## 🚀 Próximas Mejoras

- Sincronización en la nube
- Soporte multiusuario
- Integración con más apps de salud
- Análisis predictivo avanzado

---

Hecho con ❤️ para la salud y nutrición
