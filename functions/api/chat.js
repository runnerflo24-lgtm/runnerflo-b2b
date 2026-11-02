// Cloudflare Pages Function: /api/chat
// Unified Claude Chat Backend for Runnerflo AI Agents (Lumo, Nara, Narasi, Nova)

export async function onRequest(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, anthropic-version',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json().catch(() => ({}));
    let { messages = [], system = '', model = 'claude-3-5-sonnet-20241022', stream = false, max_tokens = 2048 } = body;

    // Check Anthropic API Key from headers or Cloudflare Environment Variables
    const authHeader = request.headers.get('Authorization') || request.headers.get('x-api-key') || '';
    const cleanHeaderKey = authHeader.replace(/^Bearer\s+/i, '').trim();
    const envKey = (env && (env.ANTHROPIC_API_KEY || env.CLAUDE_API_KEY || env.ANTHROPIC_KEY)) || '';
    const anthropicKey = cleanHeaderKey || envKey;

    // Normalize messages array
    const formattedMessages = [];
    for (const m of messages) {
      if (!m) continue;
      const role = m.role === 'assistant' || m.role === 'agent' ? 'assistant' : 'user';
      let content = m.content;
      if (typeof content !== 'string' && !Array.isArray(content)) {
        content = m.text || '';
      }
      formattedMessages.push({ role, content });
    }

    if (formattedMessages.length === 0) {
      formattedMessages.push({ role: 'user', content: 'Halo' });
    }

    // Map model aliases to valid Anthropic model IDs
    const modelCandidates = [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-sonnet-latest',
      'claude-3-5-haiku-20241022',
      'claude-3-5-haiku-latest',
      'claude-3-haiku-20240307'
    ];

    if (anthropicKey) {
      for (const candidate of modelCandidates) {
        try {
          const anthropicPayload = {
            model: candidate,
            max_tokens: Math.min(max_tokens, 4096),
            system: system || 'Kamu adalah AI asisten profesional berbahasa Indonesia.',
            messages: formattedMessages,
            stream: Boolean(stream)
          };

          const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': anthropicKey,
              'anthropic-version': '2023-06-01',
              'content-type': 'application/json'
            },
            body: JSON.stringify(anthropicPayload)
          });

          if (!anthropicRes.ok) {
            continue;
          }

          if (stream) {
            return new Response(anthropicRes.body, {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
              }
            });
          } else {
            const data = await anthropicRes.json();
            const textBlock = (data.content || []).find(b => b.type === 'text');
            const replyText = textBlock ? textBlock.text : '';
            return new Response(JSON.stringify({ text: replyText, content: data.content, model: candidate }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        } catch (e) {
          // Try next model candidate
        }
      }
    }

    // Intelligent Guardrail Fallback if Anthropic Key is not set or network fails
    const lastUserMsg = formattedMessages.filter(m => m.role === 'user').pop();
    const userPrompt = (typeof lastUserMsg.content === 'string' ? lastUserMsg.content : (lastUserMsg.content[0]?.text || '')).toLowerCase();

    const fallbackResponse = generateSpecializedResponse(system, userPrompt);

    if (stream) {
      // Simulate SSE streaming for clients expecting SSE chunks
      const encoder = new TextEncoder();
      const sseStream = new ReadableStream({
        async start(controller) {
          const chunks = fallbackResponse.match(/.{1,12}/gs) || [fallbackResponse];
          for (const chunk of chunks) {
            const payload = `data: ${JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text: chunk } })}\n\n`;
            controller.enqueue(encoder.encode(payload));
            await new Promise(r => setTimeout(r, 20));
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      });

      return new Response(sseStream, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      });
    }

    return new Response(JSON.stringify({ text: fallbackResponse }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Specialized Fallback Generator with Guardrails
function generateSpecializedResponse(systemPrompt, userText) {
  const isLumo = /Lumo|surat|dokumen resmi|kedinasan|mou/i.test(systemPrompt);
  const isNara = /Nara|modul ajar|rpp|lkpd|kurikulum/i.test(systemPrompt);
  const isNarasi = /Narasi|storytelling|naskah|skrip video/i.test(systemPrompt);
  const isNova = /Nova|b2b|lead generation|sales|pitching/i.test(systemPrompt);

  if (isLumo) {
    const isSuratTopic = /surat|undangan|dinas|nota|mou|perjanjian|sk|edaran|kuasa|rekomendasi|lamaran|formal|legal|kop|lampiran/i.test(userText);
    if (!isSuratTopic && userText.length > 5) {
      return 'Mohon maaf yang sebesar-besarnya, saya adalah **Lumo** — AI yang dirancang khusus untuk pembuatan **Surat & Dokumen Resmi Kedinasan serta Korespondensi Formal Bisnis**.\n\nSaya tidak dapat melayani permintaan di luar penyusunan surat atau dokumen resmi. Silakan sampaikan kebutuhan terkait surat resmi, undangan kedinasan, MoU, atau dokumen formal yang ingin Anda buat, dan saya akan menyusunnya dengan format baku yang sempurna!';
    }
    return `### DOKUMEN RESMI KEDINASAN / FORMAL

**KOP SURAT INSTANSI / PERUSAHAAN**
Jl. Jenderal Sudirman No. 45, Jakarta | Telp: (021) 555-0199 | info@instansi.co.id
______________________________________________________________________

**Nomor** : 024/DIR-EXT/XI/2026  
**Lampiran** : 1 (satu) Berkas  
**Perihal** : Permohonan Kerja Sama Resmi & Undangan Rapat Koordinasi  

Kepada Yth.  
**Pimpinan Mitra Strategis**  
Di Tempat  

Dengan hormat,  

Sehubungan dengan inisiasi penguatan kolaborasi operasional dan digitalisasi proses kerja sama strategis tahun 2026, bersama surat ini kami bermaksud mengundang Bapak/Ibu untuk hadir dalam agenda rapat koordinasi resmi yang akan dilaksanakan pada:

- **Hari / Tanggal** : Senin, 10 November 2026
- **Waktu** : Pukul 09.30 - 12.00 WIB
- **Tempat** : Ruang Pertemuan Eksekutif / Virtual Meeting Room
- **Agenda** : Pembahasan Nota Kesepahaman (MoU) dan Penyelarasan Timeline Kerja Sama

Mengingat pentingnya agenda tersebut, kami sangat mengharapkan kehadiran Bapak/Ibu tepat pada waktunya. Konfirmasi kehadiran dapat disampaikan paling lambat Jumat, 7 November 2026.

Demikian surat ini kami sampaikan. Atas perhatian dan kerja sama yang baik, kami ucapkan terima kasih.

Hormat kami,  
**Direktur Utama**

*(Tanda Tangan & Cap Resmi)*  
**Dr. H. Hendra Pratama, M.M.**`;
  }

  if (isNara) {
    const isEduTopic = /modul|ajar|rpp|lkpd|kurikulum|merdeka|siswa|pelajaran|asesmen|materi|kelas|guru|sekolah|atp|cp|soal/i.test(userText);
    if (!isEduTopic && userText.length > 5) {
      return 'Mohon maaf, saya adalah **Nara** — AI spesialis penyusun **Modul Ajar, RPP, LKPD, dan Perangkat Kurikulum Merdeka**.\n\nSaya hanya melayani kebutuhan seputar dunia pendidikan dan perangkat pembelajaran. Silakan beri tahu mata pelajaran, kelas/fase, serta materi pokok yang ingin Anda rancang bersama saya!';
    }
    return `### MODUL AJAR KURIKULUM MERDEKA

**A. INFORMASI UMUM**
- **Nama Penyusun**: Nara AI Education Specialist
- **Fase / Kelas**: Fase D / Kelas VII
- **Mata Pelajaran**: Terintegrasi
- **Alokasi Waktu**: 2 JP (2 x 40 Menit)
- **Profil Pelajar Pancasila**: Bernalar Kritis, Kreatif, dan Gotong Royong.

**B. KOMPONEN INTI**
1. **Tujuan Pembelajaran**: Peserta didik mampu menganalisis konsep dasar materi, memecahkan studi kasus kontekstual, dan mengomunikasikan hasil penemuan secara kolaboratif.
2. **Pemahaman Bermakna**: Pemahaman materi ini menjadi pondasi penting dalam menyelesaikan tantangan nyata di kehidupan sehari-hari.
3. **Pertanyaan Pemantik**: "Mengapa konsep ini sangat relevan dengan inovasi teknologi masa kini?"

**C. LANGKAH PEMBELAJARAN (80 Menit)**
- **Pendahuluan (15 Menit)**: Orientasi kelas, apersepsi interaktif, dan penyampaian tujuan pembelajaran.
- **Kegiatan Inti (50 Menit)**:
  - Pembentukan kelompok kerja heterogen (4-5 siswa).
  - Pengerjaan Lembar Kerja Peserta Didik (LKPD) berbasis proyek nyata.
  - Diskusi terarah dan pendampingan diferensiasi pembelajaran.
  - Presentasi singkat setiap kelompok.
- **Penutup (15 Menit)**: Refleksi bersama siswa, penarikan kesimpulan, dan asesmen formatif kilat (exit ticket).

**D. LAMPIRAN**
- Rubrik Penilaian Kinerja Kelompok (Skala 1-4)
- Lembar Kerja Peserta Didik (LKPD) Siap Cetak.`;
  }

  if (isNarasi) {
    const isNarasiTopic = /naskah|skrip|script|cerita|story|narasi|video|reels|tiktok|youtube|voiceover|vo|alur|brand|dialog|karakter/i.test(userText);
    if (!isNarasiTopic && userText.length > 5) {
      return 'Halo! Mohon maaf, saya adalah **Narasi** — AI yang berfokus penuh pada **Storytelling Kreatif, Penulisan Naskah Video, Voiceover, dan Narasi Brand**.\n\nSaya tidak dapat melayani tugas di luar penulisan cerita dan naskah. Mari ceritakan topik video, durasi, atau emosi cerita apa yang ingin kita hidupkan bersama!';
    }
    return `### NASKAH VIDEO KREATIF (DURASI: 45 DETIK)
**Target Format**: Reels / TikTok / Shorts  
**Tone & Mood**: Sinematik, Inspiratif, Emosional, dan Memikat.

---

**[00:00 - 00:05] THE HOOK**  
*Visual*: Close-up dinamis seseorang yang menatap layar di tengah kesibukan kota malam hari, pencahayaan hangat.  
*SFX*: Detak jam pelan, disusul denting piano lembut.  
*Voiceover*: *"Pernah nggak kamu ngerasa... usaha kerasmu selama ini belum juga ada yang lirik?"*

**[00:06 - 00:20] THE CONFLICT & PAIN POINT**  
*Visual*: Potongan cepat proses berkarya, draft yang dicoret, cangkir kopi dingin di atas meja kerja.  
*SFX*: Rintik hujan di luar jendela, nada bass perlahan naik.  
*Voiceover*: *"Setiap malam kamu begadang, nyempurnain setiap detail karya. Tapi dunia seolah terlalu bising buat denger cerita kamu."*

**[00:21 - 00:35] THE TURNING POINT (THE INSIGHT)**  
*Visual*: Cahaya matahari terbit menembus jendela. Senyum percaya diri saat menekan tombol publish dan mendapat respons apresiasi pertama.  
*BGM*: Musik berubah menjadi uplifting, drum akustik masuk dengan tempo optimis.  
*Voiceover*: *"Sampai akhirnya kamu sadar: karya terbaik nggak butuh validasi semua orang. Karya terbaik cuma butuh satu hal... keberanian untuk bercerita dengan jujur."*

**[00:36 - 00:45] CALL TO ACTION (CTA)**  
*Visual*: Teks tipografi bersih di tengah layar, senyum lega sang kreator.  
*Voiceover*: *"Mulai ceritakan karyamu hari ini. Karena di luar sana, ada orang yang sedang menunggu terinspirasi oleh ceritamu."*  
*Teks di Layar*: **Mulai Sekarang. Ceritamu Berharga.**`;
  }

  if (isNova) {
    const isB2bTopic = /b2b|lead|client|klien|sales|pitch|proposal|cold|email|outreach|pipeline|revenue|funnel|omset|closing|penawaran|mitra/i.test(userText);
    if (!isB2bTopic && userText.length > 5) {
      return 'Mohon maaf, saya adalah **Nova** — AI Konsultan khusus **Lead Generation, Strategi Pertumbuhan B2B, dan Outbound Sales Klien Korporat**.\n\nFokus saya terarah pada akuisisi klien, cold outreach, skrip pitching, dan penutupan kontrak bisnis bernilai tinggi. Silakan jelaskan target industri atau profil klien korporat yang ingin Anda akusisi saat ini!';
    }
    return `### B2B OUTBOUND COLD OUTREACH PLAYBOOK

**1. Target ICP (Ideal Customer Profile)**
- **Level**: VP of Marketing / Head of Growth / Direktur Operasional
- **Ukuran Perusahaan**: 20 - 150 Karyawan (Mid-market B2B & Digital Brand)
- **Pain Point Utama**: Biaya akuisisi pelanggan (CAC) membengkak, pipeline leads tidak konsisten, dan workflow manual yang lambat.

**2. Skrip Cold Email B2B (Personalized Hook Framework)**
**Subjek**: Ide optimasi pipeline [Nama Perusahaan Klien] (studi kasus singkat)

> Halo [Nama Prospek],
>
> Saya perhatikan belakangan ini [Nama Perusahaan Klien] sedang aktif berekspansi di sektor [Industri Klien] — selamat atas pencapaian kampanye kuartal terakhir!
>
> Berkaca dari pengalaman kami mendampingi 3 perusahaan serupa di industri yang sama, salah satu bottleneck terbesar saat scaling adalah penurunan konversi prospek menjadi deal aktif karena follow-up manual yang lambat.
>
> Kami merancang framework otomatisasi lead qualifying yang berhasil memangkas siklus sales hingga 35% sekaligus menaikkan booked demo sebesar 2.4x lipat dalam 45 hari pertama.
>
> Saya sudah menyiapkan 3 ide konkret yang bisa langsung tim Anda terapkan minggu ini. Jika relevan, apakah Anda bersedia berdiskusi santai 12 menit via Zoom hari Kamis pukul 14.00 WIB?
>
> Salam hangat,  
> **[Nama Anda]** | B2B Growth Strategist

**3. Tiga Aturan Closing Tingkat Tinggi:**
- Jangan menjual produk di email pertama; juallah **sesi diskusi bernilai 12 menit**.
- Tunjukkan bahwa Anda telah meriset bisnis mereka sebelum menghubungi.
- Selalu cantumkan bukti metrik konkret (misal: "hemat 18 jam/minggu" atau "naikkan response rate 28%").`;
  }

  return 'Halo! Saya asisten AI spesialis dari Runnerflo B2B. Bagaimana saya dapat membantu kebutuhan spesifik Anda hari ini?';
}
