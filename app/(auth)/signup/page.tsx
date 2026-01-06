import { SignupForm } from '@/components/auth/signup-form'

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Teacher Companion</h1>
          <p className="text-gray-600 mt-2">Your AI-powered lesson planning assistant</p>
        </div>
        <SignupForm />
      </div>
    </div>
  )
}
