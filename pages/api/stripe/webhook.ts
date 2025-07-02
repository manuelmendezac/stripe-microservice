import Stripe from 'stripe';
import { buffer } from 'micro';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2025-05-28.basil',
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Configura tu Supabase client
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'] as string;

  let event;

  try {
    event = stripe.webhooks.constructEvent(buf, sig, endpointSecret!);
  } catch (err) {
    console.error('Error en webhook:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  if (event.type === 'checkout.session.completed' || event.type === 'invoice.payment_succeeded') {
    const session = event.data.object;
    const customerEmail = session.customer_email || session.customer_details?.email;
    const stripe_price_id = session.metadata?.stripe_price_id || session.metadata?.price_id || session.display_items?.[0]?.price?.id;
    const tipo_producto = session.metadata?.tipo_producto;
    const producto_id = session.metadata?.producto_id;

    if (!customerEmail || !stripe_price_id || !tipo_producto || !producto_id) {
      console.error('Faltan datos clave en el webhook:', { customerEmail, stripe_price_id, tipo_producto, producto_id });
      return res.status(400).json({ error: 'Faltan datos clave para activar membresía' });
    }

    // 1. Buscar usuario
    const { data: usuario, error: userError } = await supabase
      .from('usuarios')
      .select('id')
      .eq('email', customerEmail)
      .single();

    if (userError || !usuario) {
      console.error('Usuario no encontrado:', customerEmail, userError);
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // 2. Insertar membresía activa
    const { error: insertError } = await supabase
      .from('membresias_usuarios')
      .insert([{
        user_id: usuario.id,
        tipo_producto,
        producto_id,
        stripe_price_id,
        estado: 'activa',
        fecha_inicio: new Date().toISOString(),
        created_at: new Date().toISOString(),
      }]);

    if (insertError) {
      console.error('Error insertando membresía:', insertError);
      return res.status(500).json({ error: 'Error insertando membresía' });
    }

    console.log(`Membresía activada para usuario ${customerEmail} (${usuario.id}) en producto ${producto_id} (${tipo_producto})`);
  }

  res.status(200).json({ received: true });
} 