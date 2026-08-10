export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(180deg, #C4622D 0%, #8B3A14 50%, #1C1C1E 100%)',
      padding: '0 24px',
    }}>
      {children}
    </div>
  )
}
