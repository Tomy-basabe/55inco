

const SUPABASE_URL = 'https://oiyviypyaqocfnzcyjsn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9peXZpeXB5YXFvY2ZuemN5anNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMTc3NTgsImV4cCI6MjA5NTg5Mzc1OH0.39phAgso1qv1RTkouWg8_jS3Nof626lLk1Y7hnUZk3s';
const TENANT_ID = '5inco.com';

async function migrate() {
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/products?tenant_id=eq.${TENANT_ID}`, {
    method: 'GET',
    headers
  });
  
  if (!res.ok) {
    console.error('Error fetching products', await res.text());
    return;
  }
  
  const products = await res.json();
  let updatedCount = 0;

  for (const p of products) {
    let changed = false;
    
    if (!p.cost && p.price) {
      p.cost = Math.round(p.price / 2); // 100% margin -> price = cost * 2 -> cost = price / 2
      changed = true;
    }
    
    if (p.variants && p.variants.length > 0) {
      p.variants = p.variants.map(v => {
        if (!v.cost && v.price) {
          v.cost = Math.round(v.price / 2);
          changed = true;
        }
        return v;
      });
    }

    if (changed) {
      const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${p.id}&tenant_id=eq.${TENANT_ID}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          cost: p.cost,
          variants: p.variants
        })
      });
      if (patchRes.ok) {
        updatedCount++;
      } else {
        console.error(`Failed to update ${p.id}`, await patchRes.text());
      }
    }
  }
  
  console.log(`Migration complete. Updated ${updatedCount} products.`);
}

migrate().catch(console.error);
