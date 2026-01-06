import { openai } from '@/lib/openai';
import { searchLegalSources } from '@/lib/serper';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    try {
        const { message, threadId: existingThreadId } = await req.json();

        if (!message) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }

        const assistantId = process.env.ASSISTANT_ID;
        if (!assistantId) {
            return NextResponse.json({ error: 'Assistant ID not configured' }, { status: 500 });
        }

        let threadId = existingThreadId;
        if (!threadId) {
            const thread = await openai.beta.threads.create();
            threadId = thread.id;
        }

        // Add message to thread
        await openai.beta.threads.messages.create(threadId, {
            role: 'user',
            content: message,
        });

        // Run assistant
        const stream = openai.beta.threads.runs.stream(threadId, {
            assistant_id: assistantId,
        });

        // Create a readable stream that we can pipe to the response
        const readableStream = new ReadableStream({
            async start(controller) {
                await consumeStream(stream, controller, threadId);
                controller.close();
            },
        });

        // Return response with the stream and the threadId in headers
        return new NextResponse(readableStream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'x-thread-id': threadId,
            },
        });

    } catch (error: unknown) {
        console.error('API Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

async function consumeStream(stream: ReturnType<typeof openai.beta.threads.runs.stream>, controller: ReadableStreamDefaultController, threadId: string) {
    for await (const event of stream) {
        if (event.event === 'thread.message.delta') {
            const content = event.data.delta.content?.[0];
            if (content?.type === 'text' && content.text?.value) {
                controller.enqueue(new TextEncoder().encode(content.text.value));
            }
        } else if (event.event === 'thread.run.requires_action') {
            const runId = event.data.id;
            const toolCalls = event.data.required_action?.submit_tool_outputs.tool_calls;

            if (toolCalls) {
                const toolOutputs = await Promise.all(toolCalls.map(async (tc) => {
                    if (tc.function.name === 'search_legal') {
                        let args;
                        try {
                            args = JSON.parse(tc.function.arguments);
                        } catch (e) {
                            console.error("Error parsing arguments for tool call", tc, e);
                            return { tool_call_id: tc.id, output: "Error: Invalid arguments." };
                        }
                        console.log(`Executing tool ${tc.function.name} with args:`, args);
                        const output = await searchLegalSources(args.query);
                        return { tool_call_id: tc.id, output };
                    }
                    return { tool_call_id: tc.id, output: "Error: Unknown tool." };
                }));

                console.log("Submitting tool outputs:", toolOutputs);
                const newStream = openai.beta.threads.runs.submitToolOutputsStream(
                    threadId,
                    runId,
                    { tool_outputs: toolOutputs }
                );

                await consumeStream(newStream, controller, threadId);
            }
        }
    }
}
