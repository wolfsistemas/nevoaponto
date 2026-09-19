import {
  BadgeDollarSign,
  CalendarClock,
  ClipboardCheck,
  LayoutDashboard,
  Search,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { ROUTES } from '@/lib/brand'
import type { UserRole } from '@/data/types'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  roles: UserRole[]
  mobile?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  {
    to: ROUTES.dashboard,
    label: 'Visao geral',
    icon: LayoutDashboard,
    roles: ['admin', 'encarregado', 'funcionario'],
    mobile: true,
  },
  {
    to: ROUTES.ponto,
    label: 'Bater ponto',
    icon: CalendarClock,
    roles: ['admin', 'encarregado', 'funcionario'],
    mobile: true,
  },
  {
    to: ROUTES.aprovacao,
    label: 'Aprovacoes',
    icon: ClipboardCheck,
    roles: ['admin', 'encarregado'],
    mobile: true,
  },
  {
    to: ROUTES.colaboradores,
    label: 'Colaboradores',
    icon: Users,
    roles: ['admin', 'encarregado'],
    mobile: true,
  },
  {
    to: ROUTES.folha,
    label: 'Folha',
    icon: Wallet,
    roles: ['admin', 'encarregado'],
  },
  {
    to: ROUTES.pagamentos,
    label: 'Pagamentos',
    icon: BadgeDollarSign,
    roles: ['admin'],
  },
  {
    to: ROUTES.obras,
    label: 'Obras',
    icon: Search,
    roles: ['admin'],
  },
  {
    to: ROUTES.relatorios,
    label: 'Relatorios',
    icon: Wallet,
    roles: ['admin', 'encarregado'],
  },
]

export function itensDoPerfil(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((i) => i.roles.includes(role))
}
