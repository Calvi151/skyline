interface PasswordChecklistProps {
  password: string
}

export default function PasswordChecklist({ password }: PasswordChecklistProps) {
  const hasMinLength = password.length >= 8
  const hasUppercase = /[A-Z]/.test(password)
  const hasNumber = /[0-9]/.test(password)

  const items = [
    { label: 'Minimal 8 karakter', valid: hasMinLength },
    { label: 'Minimal 1 huruf kapital (A-Z)', valid: hasUppercase },
    { label: 'Minimal 1 angka (0-9)', valid: hasNumber },
  ]

  return (
    <div className="space-y-1.5 pt-1 text-xs">
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-1.5 transition-colors">
          <span
            className={`material-symbols-outlined text-[15px] ${
              item.valid ? 'text-success' : 'text-subtle'
            }`}
          >
            {item.valid ? 'check_circle' : 'radio_button_unchecked'}
          </span>
          <span className={item.valid ? 'text-ink font-medium' : 'text-subtle'}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  )
}
