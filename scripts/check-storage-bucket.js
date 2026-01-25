require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
    console.log('🔍 Verificando buckets de storage...\n');

    // Listar buckets
    const { data: buckets, error } = await supabase.storage.listBuckets();

    if (error) {
        console.error('❌ Erro ao listar buckets:', error.message);
        return;
    }

    console.log('📦 Buckets existentes:', buckets?.map(b => b.name).join(', ') || 'nenhum');

    // Verificar se user-uploads existe
    const exists = buckets?.some(b => b.name === 'user-uploads');
    console.log('\n✅ user-uploads existe?', exists ? 'SIM' : 'NÃO');

    // Criar se não existir
    if (!exists) {
        console.log('\n🔧 Criando bucket user-uploads...');
        const { error: createError } = await supabase.storage.createBucket('user-uploads', {
            public: true,
            fileSizeLimit: 2097152 // 2MB
        });

        if (createError) {
            console.error('❌ Erro ao criar bucket:', createError.message);
        } else {
            console.log('✅ Bucket user-uploads criado com sucesso!');
        }
    }

    // Testar upload
    console.log('\n📤 Testando upload...');
    const testBuffer = Buffer.from('test file content');
    const { data: uploadData, error: uploadError } = await supabase.storage
        .from('user-uploads')
        .upload('test/test.txt', testBuffer, {
            contentType: 'text/plain',
            upsert: true
        });

    if (uploadError) {
        console.error('❌ Erro no upload de teste:', uploadError.message);
    } else {
        console.log('✅ Upload de teste OK:', uploadData.path);

        // Limpar arquivo de teste
        await supabase.storage.from('user-uploads').remove(['test/test.txt']);
        console.log('🧹 Arquivo de teste removido');
    }

    console.log('\n✅ Verificação concluída!');
}

main().catch(console.error);
