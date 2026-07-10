import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return request.cookies.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) { request.cookies.set({ name, value, ...options }); response = NextResponse.next({ request: { headers: request.headers } }); response.cookies.set({ name, value, ...options }) },
        remove(name: string, options: CookieOptions) { request.cookies.set({ name, value: '', ...options }); response = NextResponse.next({ request: { headers: request.headers } }); response.cookies.set({ name, value: '', ...options }) },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const isAuth = request.nextUrl.pathname.startsWith('/login')

  if (!user && !isAuth) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && isAuth) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|manifest.json|icon-192.png|icon-512.png).*)'],
}
