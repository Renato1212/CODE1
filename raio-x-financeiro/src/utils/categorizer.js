// Normaliza string removendo acentos e colocando em minúsculas
const norm = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

const RULES = [
  {
    id: 'income',
    name: 'Receitas',
    icon: '💰',
    color: '#22c55e',
    keywords: [
      'vencimento', 'salario', 'salário', 'ordenado', 'remuneracao', 'remuneração',
      'subsidio alimentacao', 'subsidio de ferias', 'subsidio de natal',
      'transferencia recebida', 'transferência recebida',
      'mb way recebido', 'mbway recebido',
      'reembolso', 'devolucao', 'devolução',
      'rendimento', 'dividendo', 'juro creditado', 'juro a credito',
      'premio', 'prémio',
    ],
    positiveOnly: true,
  },
  {
    id: 'food_out',
    name: 'Alimentação fora',
    icon: '🍔',
    color: '#f97316',
    keywords: [
      'uber* eats', 'uber eats', 'ubereats',
      'glovo', 'bolt food', 'boltfood',
      'mcdonalds', "mcdonald's", 'burger king', 'burgerking',
      'telepizza', 'pizza hut', 'dominos', 'domino',
      'h3 burger', ' h3 ', 'kfc',
      'nandos', "nando's", 'subway',
      'sushi', 'wok', 'thai', 'india',
      'churrasqueira', 'marisqueira', 'cervejaria', 'tascas',
      'tasca do', 'restaurante', 'restaurant',
      'pastelaria', 'padaria portuguesa', 'padaria',
      'cafe ', 'café ', 'cafetaria', 'snack bar',
      'the coffee', 'starbucks', 'jeronymo', 'a brasileira',
      'nicola', 'versailles', 'benard',
      'pans ', 'ten with friends',
    ],
  },
  {
    id: 'supermarket',
    name: 'Supermercado',
    icon: '🛒',
    color: '#10b981',
    keywords: [
      'continente', 'pingo doce', 'pingodoce',
      'lidl', 'aldi', 'auchan', 'jumbo',
      'intermarche', 'intermarché', 'mini preco', 'minipreco', 'mini preço',
      'el corte ingles', 'celeiro', 'mercadona',
      'makro', 'costco', 'supermercado',
      'supercor', 'bom dia mercearia',
    ],
  },
  {
    id: 'transport',
    name: 'Transportes',
    icon: '🚗',
    color: '#3b82f6',
    keywords: [
      'via verde', 'viaverde',
      'galp ', 'galp-', 'posto galp',
      'bp ', ' bp ', 'posto bp',
      'repsol', 'prio energia', 'cepsa',
      'uber trip', 'uber* trip',
      'bolt ride', 'bolt trip',
      'free now', 'cabify',
      'cp comboios', 'cp.pt', 'comboios de portugal',
      'metro de lisboa', 'metro do porto',
      'carris ', 'stcp',
      'flixbus', 'rede expressos',
      'saba ', 'empark', 'emel ',
      'auto-estrada', 'portagem',
      'ryanair', 'tap air', 'easyjet', 'wizz',
    ],
  },
  {
    id: 'home',
    name: 'Casa',
    icon: '🏠',
    color: '#8b5cf6',
    keywords: [
      'renda ', 'renda-', 'arrendamento',
      'condominio', 'condomínio',
      'edp comercial', 'edp ', ' edp',
      'galp energia', 'endesa', 'iberdrola',
      'aguas de lisboa', 'aguas do porto', 'aguas ', 'aguas-',
      'servicos municipalizados',
      'meo ', ' meo', 'meo-',
      'nos ', ' nos', 'nos-',
      'vodafone', 'nowo',
      'seguro casa', 'seguro habitacao', 'seguro habitação',
      'condominium', 'imobiliaria',
    ],
  },
  {
    id: 'health',
    name: 'Saúde',
    icon: '💊',
    color: '#ec4899',
    keywords: [
      'farmacia', 'farmácia',
      'wells ', 'holon',
      'clinica', 'clínica', 'hospital',
      'medico', 'médico', 'dentista',
      'advancecare', 'multicare', 'medis', 'fidelidade saude',
      'optica', 'óptica',
      'fisioterapia', 'psicologia',
      'dr. ', 'dra. ',
      'laboratorio', 'laboratório',
    ],
  },
  {
    id: 'leisure',
    name: 'Lazer e subscrições',
    icon: '🎬',
    color: '#f59e0b',
    keywords: [
      'netflix', 'spotify', 'hbo max', 'hbo ',
      'disney+', 'disney plus',
      'amazon prime', 'prime video',
      'dazn', 'apple tv', 'apple music',
      'youtube premium', 'twitch', 'crunchyroll',
      'playstation', 'xbox', 'nintendo', 'steam ',
      'cinema', 'nos cinemas', 'zon lusomundo',
      'fitness hut', 'holmes place', 'ginasio', 'ginásio',
      'clube de ', 'health club',
      'booking.com', 'airbnb',
      'museu', 'teatro', 'concerto',
    ],
  },
  {
    id: 'shopping',
    name: 'Compras',
    icon: '🛍️',
    color: '#06b6d4',
    keywords: [
      'amazon', 'amazon.es', 'amazon.de',
      'aliexpress', 'shein', 'zaful',
      'zara ', 'h&m ', 'primark', 'mango ',
      'decathlon', 'ikea', 'leroy merlin',
      'fnac ', 'worten',
      'sport zone', 'footlocker', 'foot locker',
      'bershka', 'pull&bear', 'pull & bear',
      'stradivarius', 'massimo dutti',
      'springfield', 'calzedonia', 'parfois',
      'vans ', 'nike ', 'adidas ',
      'freeport', 'forum sintra', 'arrábida shopping',
    ],
  },
  {
    id: 'education',
    name: 'Educação',
    icon: '📚',
    color: '#14b8a6',
    keywords: [
      'udemy', 'coursera', 'alura',
      'linkedin learning', 'skillshare', 'domestika',
      'livraria', 'bertrand', 'fnac livros',
      'propinas', 'matricula',
      'escola ', 'universidade', 'instituto',
      'formacao', 'formação',
    ],
  },
  {
    id: 'work',
    name: 'Trabalho/Profissional',
    icon: '💼',
    color: '#64748b',
    keywords: [
      'github', 'notion', 'figma', 'adobe',
      'microsoft 365', 'office 365',
      'google workspace', 'gsuite',
      'aws ', 'netlify', 'vercel', 'digitalocean',
      'namecheap', 'godaddy', 'cloudflare',
      'slack ', 'zoom ', 'atlassian',
      'coworking', 'secondhome',
    ],
  },
  {
    id: 'transfers_out',
    name: 'Transferências enviadas',
    icon: '💸',
    color: '#94a3b8',
    keywords: [
      'mb way enviado', 'mbway enviado',
      'transferencia enviada', 'transferência enviada',
      'sepa credit transfer',
      'transferencia para', 'transferência para',
      'pagamento a', 'pagamento de servicos',
    ],
    negativeOnly: true,
  },
  {
    id: 'fees',
    name: 'Taxas e comissões',
    icon: '🏦',
    color: '#ef4444',
    keywords: [
      'comissao', 'comissão',
      'manutencao conta', 'manutenção conta',
      'imposto do selo', 'imposto selo',
      'anuidade cartao', 'anuidade cartão',
      'taxa de ', 'juro debito', 'juro débito',
      'penalizacao', 'penalização',
      'servico bancario', 'serviço bancário',
      'gestao conta', 'gestão conta',
      'comissao levantamento',
    ],
  },
]

export const CATEGORY_MAP = Object.fromEntries(RULES.map((r) => [r.id, r]))

export function categorize(description, amount) {
  const d = norm(description)

  for (const rule of RULES) {
    if (rule.positiveOnly && amount <= 0) continue
    if (rule.negativeOnly && amount >= 0) continue

    for (const kw of rule.keywords) {
      if (d.includes(norm(kw))) {
        return { id: rule.id, name: rule.name, icon: rule.icon, color: rule.color }
      }
    }
  }

  // Fallback: positive amounts → income
  if (amount > 0) {
    const r = RULES.find((x) => x.id === 'income')
    return { id: r.id, name: r.name, icon: r.icon, color: r.color }
  }

  return { id: 'other', name: 'Outros', icon: '❓', color: '#6b7280' }
}

export const ALL_CATEGORIES = [
  ...RULES,
  { id: 'other', name: 'Outros', icon: '❓', color: '#6b7280' },
]
