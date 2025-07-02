import Stripe from 'stripe';
import type { NextApiRequest, NextApiResponse } from 'next';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2025-06-30.basil',
});

const stripeKey = process.env.STRIPE_SECRET_KEY;
console.log('[STRIPE] Clave presente:', !!stripeKey, 'Longitud:', stripeKey ? stripeKey.length : 0);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  console.log('[STRIPE] Body recibido:', req.body);

  const { nombre, descripcion, precio, tipo_pago, moneda = 'usd', periodicidad } = req.body;

  if (!nombre || !precio || !tipo_pago) {
    return res.status(400).json({ 
      error: 'Faltan datos requeridos: nombre, precio y tipo_pago son obligatorios' 
    });
  }

  if (typeof precio !== 'number' || precio <= 0) {
    return res.status(400).json({ 
      error: 'El precio debe ser un número positivo' 
    });
  }

  if (!['pago_unico', 'suscripcion'].includes(tipo_pago)) {
    return res.status(400).json({ 
      error: 'tipo_pago debe ser "pago_unico" o "suscripcion"' 
    });
  }

  try {
    // 1. Crear producto en Stripe
    const producto = await stripe.products.create({
      name: nombre,
      description: descripcion || '',
      metadata: {
        tipo_pago,
        precio_original: precio.toString(),
      },
    });

    // 2. Crear precio en Stripe
    const priceData: Stripe.PriceCreateParams = {
      product: producto.id,
      unit_amount: Math.round(precio * 100),
      currency: moneda,
    };
    if (tipo_pago === 'suscripcion') {
      priceData.recurring = { interval: (periodicidad || 'month') as 'day' | 'week' | 'month' | 'year' };
    }
    const price = await stripe.prices.create(priceData);

    // 3. Devolver los IDs para guardar en la BD
    return res.status(200).json({
      success: true,
      stripe_product_id: producto.id,
      stripe_price_id: price.id,
      precio_centavos: price.unit_amount,
      moneda: price.currency,
    });
  } catch (error) {
    console.error('Error en Stripe API:', error);
    if (error instanceof Error && (error as any).type === 'StripeCardError') {
      return res.status(400).json({ error: 'Error en la tarjeta de crédito' });
    } else if (error instanceof Error && (error as any).type === 'StripeInvalidRequestError') {
      return res.status(400).json({ error: 'Datos de pago inválidos' });
    } else if (error instanceof Error && (error as any).type === 'StripeAPIError') {
      return res.status(500).json({ error: 'Error en el servidor de Stripe' });
    }
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
} 