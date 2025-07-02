import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2025-05-28.basil',
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  console.log('BODY RECIBIDO EN SUBSCRIPTION:', req.body);

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
    // Crear sesión de checkout para suscripción
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: stripe_price_id,
          quantity: 1,
        },
      ],
      mode: 'subscription', // Para suscripciones
      success_url: success_url || `${process.env.NEXT_PUBLIC_BASE_URL}/suscripcion-exitosa?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancel_url || `${process.env.NEXT_PUBLIC_BASE_URL}/suscripcion-cancelada`,
      customer_email: customer_email,
      metadata: {
        ...metadata,
        created_at: new Date().toISOString(),
      },
      // Configuración específica para suscripciones
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      subscription_data: {
        metadata: {
          ...metadata,
          subscription_created_at: new Date().toISOString(),
        },
      },
    });

    console.log('SESSION STRIPE RESPUESTA:', session);

    return res.status(200).json({
      success: true,
      session_id: session.id,
      checkout_url: session.url,
    });
  } catch (error) {
    console.error('Error en suscripción:', error);
    
    if (error.type === 'StripeInvalidRequestError') {
      return res.status(400).json({ error: 'Datos de suscripción inválidos' });
    }
    
    return res.status(500).json({ 
      error: 'Error al crear sesión de suscripción',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
} 