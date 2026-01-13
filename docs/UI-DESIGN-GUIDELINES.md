# 🎨 UI Design Guidelines - Regras Obrigatórias

## ⚠️ **REGRA CRÍTICA: BACKGROUNDS SEMPRE PRESENTES**

**NUNCA crie popups, dialogs, menus suspensos, dropdowns ou qualquer elemento sobreposto SEM um background sólido.**

### ❌ **Problemas Comuns**
- Popover transparente (ilegível)
- Dialog sem fundo (texto invisível)
- Dropdown menu transparente
- Tooltip sem contraste

### ✅ **Solução Obrigatória**

**TODOS os componentes sobrepostos DEVEM ter:**

```tsx
// ✅ SEMPRE adicionar className com background
<PopoverContent className="!bg-white dark:!bg-slate-900 text-slate-900 dark:text-slate-50 border shadow-xl">
  {/* conteúdo aqui */}
</PopoverContent>

<DialogContent className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50">
  {/* conteúdo aqui */}
</DialogContent>

<DropdownMenuContent className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 border">
  {/* conteúdo aqui */}
</DropdownMenuContent>
```

---

## 📋 **Checklist de Componentes UI**

### 1. **Popover** (shadcn/ui)
```tsx
<PopoverContent 
  className="w-80 p-0 !bg-white dark:!bg-slate-900 text-slate-900 dark:text-slate-50 border border-gray-200 dark:border-slate-700 shadow-xl"
>
  {/* SEMPRE incluir className com !bg-white */}
</PopoverContent>
```

### 2. **Dialog/Modal**
```tsx
<DialogContent className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50">
  <DialogHeader>
    <DialogTitle>Título</DialogTitle>
  </DialogHeader>
  {/* conteúdo */}
</DialogContent>
```

### 3. **DropdownMenu**
```tsx
<DropdownMenuContent className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 border">
  <DropdownMenuItem>Item 1</DropdownMenuItem>
</DropdownMenuContent>
```

### 4. **Select (shadcn/ui)**
```tsx
<SelectContent className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50">
  <SelectItem value="option1">Option 1</SelectItem>
</SelectContent>
```

### 5. **Tooltip**
```tsx
<TooltipContent className="bg-gray-900 dark:bg-slate-800 text-white border">
  Texto do tooltip
</TooltipContent>
```

---

## 🎨 **Padrões de Cores Aprovados**

### Background Primário
```css
bg-white dark:bg-slate-900
```

### Background Secundário (Headers)
```css
bg-gradient-to-r from-[#1a2b4a] to-[#2c3e5f]
```

### Background Alternativo
```css
bg-gray-50 dark:bg-slate-800
```

### Borders
```css
border-gray-200 dark:border-slate-700
```

### Text
```css
text-slate-900 dark:text-slate-50
```

---

## 🚫 **Erros a EVITAR**

### ❌ **NUNCA fazer:**
```tsx
// ❌ SEM BACKGROUND (PROIBIDO)
<PopoverContent>
  Conteúdo invisível
</PopoverContent>

// ❌ TRANSPARÊNCIA EXCESSIVA
<DialogContent className="opacity-50">
  Ilegível
</DialogContent>

// ❌ BACKGROUND HERDADO (não confiar)
<DropdownMenuContent>
  Pode ser transparente
</DropdownMenuContent>
```

### ✅ **SEMPRE fazer:**
```tsx
// ✅ EXPLÍCITO E SÓLIDO
<PopoverContent className="!bg-white dark:!bg-slate-900 text-slate-900 dark:text-slate-50 border shadow-xl">
  Conteúdo legível
</PopoverContent>

// ✅ CONTRASTE GARANTIDO
<DialogContent className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50">
  Totalmente legível
</DialogContent>
```

---

## 🔧 **Debugging de Componentes Transparentes**

### Se um componente estiver transparente:

1. **Adicionar `!important` ao background:**
```tsx
className="!bg-white dark:!bg-slate-900"
```

2. **Verificar z-index:**
```tsx
className="z-50"
```

3. **Adicionar shadow para destacar:**
```tsx
className="shadow-xl"
```

4. **Testar em dark mode:**
```bash
# No navegador: inspecionar elemento e verificar
# Se CSS computed mostra `background: transparent` → PROBLEMA
```

---

## 📝 **Exemplo Completo (Status History Popover)**

```tsx
<Popover>
  <PopoverTrigger asChild>
    <Button variant="ghost" size="sm">
      <Eye className="h-4 w-4" />
    </Button>
  </PopoverTrigger>
  
  {/* ✅ CORRETO: Background explícito */}
  <PopoverContent 
    className="w-80 p-0 !bg-white dark:!bg-slate-900 text-slate-900 dark:text-slate-50 border border-gray-200 dark:border-slate-700 shadow-xl opacity-100"
    align="end"
  >
    {/* Header com gradient */}
    <div className="bg-gradient-to-r from-[#1a2b4a] to-[#2c3e5f] text-white px-4 py-3 rounded-t-lg">
      <h4 className="font-bold">Status History</h4>
    </div>
    
    {/* Body com background branco */}
    <div className="p-4 bg-white dark:bg-slate-900">
      Conteúdo totalmente legível
    </div>
  </PopoverContent>
</Popover>
```

---

## ✅ **Checklist de Deploy**

Antes de fazer commit/deploy, verificar:

- [ ] Todos os `<PopoverContent>` têm `!bg-white dark:!bg-slate-900`
- [ ] Todos os `<DialogContent>` têm `bg-white dark:bg-slate-900`
- [ ] Todos os `<SelectContent>` têm background explícito
- [ ] Todos os `<DropdownMenuContent>` têm background
- [ ] Tooltips têm contraste suficiente
- [ ] Testado em dark mode
- [ ] Testado em produção (não apenas dev)

---

## 🎯 **Resumo: A REGRA DE OURO**

> **"Se o componente flutua sobre outro conteúdo, SEMPRE adicione background explícito com `!important` se necessário."**

**Fim das regras. CUMPRA-AS SEMPRE. 🚨**
