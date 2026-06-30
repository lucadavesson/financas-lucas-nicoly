export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#1C1C1E',
      padding: '0 24px',
    }}>
      {children}
    </div>
  )
}
