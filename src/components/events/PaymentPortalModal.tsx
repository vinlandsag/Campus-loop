'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { X, CreditCard, Lock } from 'lucide-react'

interface PaymentPortalModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  price: number
  eventTitle: string
}

export function PaymentPortalModal({ isOpen, onClose, onSuccess, price, eventTitle }: PaymentPortalModalProps) {
  const [isProcessing, setIsProcessing] = useState(false)

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsProcessing(true)
    await new Promise((resolve) => setTimeout(resolve, 2000))
    setIsProcessing(false)
    onSuccess()
  }

  if (!isOpen || typeof document === 'undefined') return null

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      {/* Backdrop */}
      <div 
        style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />
      
      {/* Modal Card */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: '420px',
          margin: '0 16px',
          backgroundColor: 'white',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e5e5' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CreditCard style={{ width: '16px', height: '16px', color: '#d97706' }} />
              </div>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>Complete Payment</h2>
                <p style={{ fontSize: '12px', color: '#888', margin: 0 }}>{eventTitle}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '6px', borderRadius: '8px', border: 'none', background: 'none', cursor: 'pointer', color: '#888' }}
            >
              <X style={{ width: '16px', height: '16px' }} />
            </button>
          </div>
        </div>

        <form onSubmit={handlePay}>
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Price */}
            <div style={{ padding: '20px', borderRadius: '12px', background: 'linear-gradient(135deg, #fffbeb, #f5f5f4)', textAlign: 'center' }}>
              <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888', margin: 0 }}>Total Due</p>
              <p style={{ fontSize: '36px', fontWeight: 800, color: '#1a1a1a', margin: '4px 0 0' }}>₹{price.toFixed(2)}</p>
            </div>

            {/* Card Number */}
            <div>
              <Label htmlFor="pm-card" style={{ fontSize: '12px' }}>Card Number</Label>
              <Input id="pm-card" placeholder="4242 4242 4242 4242" required maxLength={19} style={{ marginTop: '4px' }} />
            </div>
            
            {/* Expiry + CVC */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <Label htmlFor="pm-expiry" style={{ fontSize: '12px' }}>Expiry</Label>
                <Input id="pm-expiry" placeholder="MM / YY" required maxLength={5} style={{ marginTop: '4px' }} />
              </div>
              <div>
                <Label htmlFor="pm-cvc" style={{ fontSize: '12px' }}>CVC</Label>
                <Input id="pm-cvc" placeholder="123" required maxLength={4} style={{ marginTop: '4px' }} />
              </div>
            </div>

            <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '11px', color: '#aaa', margin: 0 }}>
              <Lock style={{ width: '12px', height: '12px' }} />
              Demo mode — any card number works.
            </p>
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px 24px', borderTop: '1px solid #e5e5e5', backgroundColor: '#fafafa' }}>
            <Button type="submit" className="w-full" disabled={isProcessing}>
              {isProcessing ? 'Processing…' : `Pay ₹${price.toFixed(2)} & Register`}
            </Button>
            <Button type="button" variant="outline" className="w-full" onClick={onClose} disabled={isProcessing}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
