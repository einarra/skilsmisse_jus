import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import OpenAI from 'openai';

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const kilderDir = path.join(process.cwd(), '../kilder');
const vectorStoreName = "Skillsmisse Jus Store";
const assistantName = "Skillsmisse Jus Agent";

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("❌ OPENAI_API_KEY is not set in environment variables.");
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey });

  console.log("📂 Checking for files in:", kilderDir);
  if (!fs.existsSync(kilderDir)) {
    console.error("❌ Kilder directory not found at:", kilderDir);
    process.exit(1);
  }

  const files = fs.readdirSync(kilderDir).filter(f => f.endsWith('.pdf') || f.endsWith('.md'));
  console.log(`found ${files.length} files (PDF/MD).`);

  // 1. Create or Get Vector Store
  let vectorStoreId;
  // @ts-ignore
  const vectorStores = await openai.vectorStores.list();
  const existingStore = vectorStores.data.find((vs: any) => vs.name === vectorStoreName);

  if (existingStore) {
    console.log(`✅ Found existing Vector Store: ${existingStore.id}`);
    vectorStoreId = existingStore.id;
  } else {
    console.log("🚀 Creating new Vector Store...");
    // @ts-ignore
    const newStore = await openai.vectorStores.create({
      name: vectorStoreName,
    });
    vectorStoreId = newStore.id;
    console.log(`✅ Created Vector Store: ${vectorStoreId}`);
  }

  // 2. Upload Files to Vector Store
  // Only upload if store is empty or we want to force update (simple logic: just upload all for now, OpenAI handles dups usually or we catch error)
  // Check file counts in store
  // @ts-ignore
  const storeFiles = await openai.vectorStores.files.list(vectorStoreId);
  const existingFileNames = new Set(); // Can't easily get names from file list directly without retrieving file objects, but let's just upload.
  // Actually, better to use the file_batches upload which handles things well.

  console.log("uploading files...");
  const fileIds: string[] = [];

  for (const file of files) {
    const filePath = path.join(kilderDir, file);
    console.log(`Uploading ${file}...`);
    try {
      const fileStream = fs.createReadStream(filePath);
      const uploadedFile = await openai.files.create({
        file: fileStream,
        purpose: 'assistants',
      });
      fileIds.push(uploadedFile.id);
      console.log(`✅ Uploaded ${file} (ID: ${uploadedFile.id})`);
    } catch (error) {
      console.error(`❌ Failed to upload ${file}:`, error);
    }
  }

  if (fileIds.length > 0) {
    console.log(`Adding ${fileIds.length} files to vector store...`);
    // @ts-ignore
    await openai.vectorStores.fileBatches.createAndPoll(vectorStoreId, {
      file_ids: fileIds
    });
    console.log("✅ Files added to vector store.");
  } else {
    console.log("⚠️ No files were successfully uploaded.");
  }

  // 3. Create or Update Assistant
  const assistants = await openai.beta.assistants.list();
  const existingAssistant = assistants.data.find(a => a.name === assistantName);

  let assistantId;
  const instructions = `
Du er en juridisk assistent som spesialiserer seg på norsk skilsmesse- og familierett.
Den viktigste loven er "lov om ekteskap", som finnes i kildene mine. Men de andre lovene er også viktige.

Du har tilgang til opplastede dokumenter i din vector store og et søkeverktøy \`search_legal\`.
- Start med å søke i de opplastede dokumentene. 
- Berike deretter svaret ditt med hvordan regelverket er fulgt i praksis ved å bruke søkeverktøyet \`search_legal\`.
- Legg ved nyttige linker til websteder du finner i søkeverktøyet \`search_legal\`.


VIKTIG OM KILDEHENVISNING
Du skal ALLTID oppgi hvilken lov og hvilken paragraf (§) svaret ditt er basert på. 
F.eks: "I henhold til Ekteskapsloven § 58..." eller "Dette følger av Husstandsfellesskapsloven § 3." 
Du skal også legge ved lenke til alle websteder du finner i søkeverktøyet \`search_legal\`.


Dersom du ikke finner svaret i kildene, skal du tydelig si: "Jeg finner ikke informasjon om dette i kildene mine".
Du skal være saklig og presis, men også utfyllende og hjelpsom. Gi utfyllende forklaringer ved å benytte søkeverktøyet \`search_legal\`.

Svar på norsk.
  `.trim();

  const tools: any[] = [
    { type: "file_search" },
    {
      type: "function",
      function: {
        name: "search_legal",
        description: "Søk etter juridisk informasjon på jusinfo.no og lovdata.no. Bruk dette til å berike svaret ditt med hvordan regelverket er fulgt i praksis og finne oppdaterte lovtekster.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Søkeord eller spørsmål."
            }
          },
          required: ["query"]
        }
      }
    }
  ];

  if (existingAssistant) {
    console.log(`✅ Found existing Assistant: ${existingAssistant.id}`);
    assistantId = existingAssistant.id;

    // Update instructions and tool resources just in case
    await openai.beta.assistants.update(assistantId, {
      instructions: instructions,
      tool_resources: {
        file_search: {
          vector_store_ids: [vectorStoreId]
        }
      },
      tools: tools
    });
    console.log("Updated assistant with latest settings.");
  } else {
    console.log("🚀 Creating new Assistant...");
    const newAssistant = await openai.beta.assistants.create({
      name: assistantName,
      instructions: instructions,
      model: "gpt-4o",
      tools: tools,
      tool_resources: {
        file_search: {
          vector_store_ids: [vectorStoreId]
        }
      }
    });
    assistantId = newAssistant.id;
    console.log(`✅ Created Assistant: ${assistantId}`);
  }

  console.log("\n🎉 Setup Complete!");
  console.log(`Assistant ID: ${assistantId}`);
  console.log(`Vector Store ID: ${vectorStoreId}`);
  console.log("\nAdd these to your .env.local file:");
  console.log(`NEXT_PUBLIC_ASSISTANT_ID=${assistantId}`);
}

main().catch(console.error);
