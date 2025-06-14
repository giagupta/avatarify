import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'OpenAI API key is not configured' },
      { status: 500 }
    );
  }

  try {
    const formData = await request.formData();
    const image = formData.get('image');
    
    console.log('Received image:', {
      type: image?.constructor?.name,
      size: image instanceof Blob ? image.size : 'N/A',
      mimeType: image instanceof Blob ? image.type : 'N/A'
    });

    if (!image || !(image instanceof Blob)) {
      console.error('Invalid image:', { image });
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 }
      );
    }

    // Convert image to base64
    const arrayBuffer = await image.arrayBuffer();
    const base64String = Buffer.from(arrayBuffer).toString('base64');

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    // First, analyze the image with GPT-4 Vision
    console.log('Analyzing image with GPT-4 Vision...');
    const visionResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${image.type};base64,${base64String}`
              }
            },
            { 
              type: 'text', 
              text: 'Describe this person for a Notion-style avatar. Focus on: gender presentation, face shape (round/oval/etc), exact hairstyle details (length, texture, how it falls), glasses if any (shape and size), key facial features (eyes, eyebrows, nose, lips), and overall expression. Be specific about features that make them uniquely recognizable.'
            }
          ]
        }
      ],
      max_tokens: 1000
    });

    const description = visionResponse.choices[0]?.message?.content;
    console.log('Vision analysis:', description);

    if (!description) {
      throw new Error('Failed to analyze the image');
    }

    if (description.length < 20) {
      console.error('Description too short:', description);
      throw new Error('Image analysis produced insufficient description');
    }

    // Now generate the avatar with DALL-E
    console.log('Generating avatar with DALL-E...');
    const prompt = `Create an extremely minimalist black and white avatar in a simple cartoon style. Study the reference carefully.

STYLE REQUIREMENTS:
1. Face: Simple shape with minimal detail, no outline necessary
2. Eyes: Ultra-minimal - can be dots, simple curves, or even just lines
3. Eyebrows: Optional, only if needed for expression
4. Nose: Usually omitted, or just a tiny dot/line if needed
5. Mouth: Simple expression - can be a curve, line, or basic shape
6. Glasses: If present, just basic round or rectangular frames
7. Hair: Simple solid black shapes with clean edges

CRITICAL STYLE NOTES:
- Pure black (#000000) on white (#FFFFFF) only
- Extremely minimal - use as few lines as possible
- No outlines around face or features
- No shading or gradients
- Must look hand-drawn and friendly
- Focus on capturing personality through minimal expression
- Think emoji-like simplicity but with personality

Think: Simple, friendly, expressive emoticon style - as minimal as possible while still being cute and recognizable.`;
    
    console.log('DALL-E prompt:', prompt);

    const imageResponse = await openai.images.generate({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1024x1024',
      response_format: 'url',
      quality: 'hd',
      style: 'vivid'
    });

    if (!imageResponse.data?.[0]?.url) {
      throw new Error('Failed to generate avatar');
    }

    return NextResponse.json({ url: imageResponse.data[0].url });

  } catch (error: any) {
    console.error('Full error object:', error);
    console.error('Error message:', error.message);
    console.error('Error name:', error.name);
    console.error('Error stack:', error.stack);
    
    if (error.response) {
      console.error('OpenAI API error response:', await error.response.json().catch(() => 'No JSON response'));
    }

    return NextResponse.json(
      { 
        error: error?.message || 'Failed to generate avatar',
        details: {
          message: error.message,
          name: error.name,
          stack: error.stack,
          response: error.response ? await error.response.json().catch(() => null) : null
        }
      },
      { status: 500 }
    );
  }
}
