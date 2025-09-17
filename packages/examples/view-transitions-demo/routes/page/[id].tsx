import { PageProps } from "$fresh/server.ts";

export default function Page({ params }: PageProps) {
  const id = parseInt(params.id, 10);
  return (
    <div class="h-screen bg-gray-100 flex flex-col items-center justify-center">
      <div class="w-full max-w-md mx-auto bg-white rounded-lg shadow-md p-8">
        <h1 class="text-4xl font-bold text-gray-800 mb-4">Page {id}</h1>
        <p class="text-gray-600 mb-6">
          This is page {id}.
        </p>
        <div class="flex justify-between">
          {id > 1 && (
            <a
              href={id === 2 ? "/" : `/page/${id - 1}`}
              class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              Previous
            </a>
          )}
          <a
            href={`/page/${id + 1}`}
            class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Next
          </a>
        </div>
      </div>
    </div>
  );
}
