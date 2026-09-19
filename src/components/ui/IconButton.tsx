import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './IconButton.module.css'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode
  label: string
}

export function IconButton({ icon, label, className, ...props }: IconButtonProps) {
  return (
    <button className={[styles.button, className].filter(Boolean).join(' ')} aria-label={label} {...props}>
      {icon}
    </button>
  )
}
