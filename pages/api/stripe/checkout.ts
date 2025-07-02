import Stripe from 'stripe';
import type { NextApiRequest, NextApiResponse } from 'next';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2025-06-30.basil',
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { 
    stripe_price_id, 
    success_url, 
    cancel_url, 
    customer_email,
    metadata = {}
  } = req.body;

  if (!stripe_price_id) {
    return res.status(400).json({ 
      error: 'stripe_price_id es requerido' 
    });
  }

  try {
    // Crear sesión de checkout
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: stripe_price_id,
          quantity: 1,
        },
      ],
      mode: 'payment', // Para pagos únicos
      success_url: success_url || `${process.env.NEXT_PUBLIC_BASE_URL}/pago-exitoso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancel_url || `${process.env.NEXT_PUBLIC_BASE_URL}/pago-cancelado`,
      customer_email: customer_email,
      metadata: {
        ...metadata,
        created_at: new Date().toISOString(),
      },
      // Configuración adicional para mejor UX
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      shipping_address_collection: {
        allowed_countries: ['US', 'CA', 'MX', 'ES', 'AR', 'CL', 'CO', 'PE'],
      },
    });

    return res.status(200).json({
      success: true,
      session_id: session.id,
      checkout_url: session.url,
    });
  } catch (error) {
    console.error('Error en checkout:', error);
    if (
      typeof error === 'object' &&
      error !== null &&
      'type' in error &&
      (error as { type?: string }).type === 'StripeInvalidRequestError'
    ) {
      return res.status(400).json({ error: 'Datos de checkout inválidos' });
    }
    return res.status(500).json({ 
      error: 'Error al crear sesión de checkout',
      details: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined
    });
  }
} 