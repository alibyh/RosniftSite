# Роснефть - Корпоративная Торговая Площадка

Internal Corporate Marketplace for Goods and Delivery Cost Calculation

## 🚀 Quick Start

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser to `http://localhost:3000`

## 🎨 Features

- ✅ React + TypeScript
- ✅ Redux Toolkit for state management
- ✅ Russian/English translations (i18n)
- ✅ Rosneft branding colors (Black & Yellow #FED208)
- ✅ Modern, responsive design

## 📁 Project Structure

```
src/
├── features/
│   └── auth/
│       ├── components/
│       │   ├── Login.tsx
│       │   └── Login.css
│       └── authSlice.ts
├── i18n/
│   ├── i18n.ts
│   └── translations.ts
├── store/
│   ├── store.ts
│   └── hooks.ts
├── App.tsx
└── main.tsx
```

## 🎯 Current Status

- ✅ Login page with Rosneft branding
- ✅ Redux authentication state management
- ✅ Russian/English language switching
- ⏳ Marketplace page (coming next)
- ⏳ Shopping cart functionality
- ⏳ Cost calculation system

## 🧪 Testing

To test the login:
1. Enter any username (3+ characters)
2. Enter any password (3+ characters)
3. Click "Войти" (Sign In)
4. Language can be switched using the RU/EN button

## 📝 Notes

- Default language is Russian
- Authentication is currently mocked for development
- Session storage is used for "Remember me" functionality

