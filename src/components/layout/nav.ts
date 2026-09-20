import {
  BadgeDollarSign,
  Building2,
  CalendarClock,
  ClipboardCheck,
  CreditCard,
  LayoutDashboard,
  Search,
  ShieldCheck,
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
  labelPorRole?: Partial<Record<UserRole, string>>
}

export const NAV_ITEMS: NavItem[] = [
  {
    to: ROUTES.superadmin,
    label: 'Super Admin',
    icon: ShieldCheck,
    roles: ['superadmin'],
    mobile: true,
  },
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
    roles: ['admin', 'encarregado', 'funcionario'],
    mobile: true,
    labelPorRole: { funcionario: 'Minha folha' },
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
    to: ROUTES.empresa,
    label: 'Empresa',
    icon: Building2,
    roles: ['admin'],
  },
  {
    to: ROUTES.relatorios,
    label: 'Relatorios',
    icon: Wallet,
    roles: ['admin', 'encarregado'],
  },
  {
    to: ROUTES.assinatura,
    label: 'Assinatura',
    icon: CreditCard,
    roles: ['admin'],
  },
]

export function itensDoPerfil(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((i) => i.roles.includes(role))
}

export function rotuloDoItem(item: NavItem, role: UserRole): string {
  return item.labelPorRole?.[role] ?? item.label
}
