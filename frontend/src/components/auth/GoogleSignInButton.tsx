import { GoogleLogin, CredentialResponse } from '@react-oauth/google'
import { useThemeStore } from '../../store/themeStore'

interface GoogleSignInButtonProps {
  onSuccess: (credentialResponse: CredentialResponse) => void
  onError?: () => void
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
}

export default function GoogleSignInButton({
  onSuccess,
  onError,
  text = 'continue_with',
}: GoogleSignInButtonProps) {
  const theme = useThemeStore((s) => s.theme)
  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)

  return (
    <div className="w-full flex justify-center [&>div]:w-full [&>div>iframe]:w-full">
      <GoogleLogin
        onSuccess={onSuccess}
        onError={onError || (() => console.error('Google sign in failed'))}
        theme={isDark ? 'filled_black' : 'outline'}
        size="large"
        shape="rectangular"
        text={text}
        width="100%"
      />
    </div>
  )
}
