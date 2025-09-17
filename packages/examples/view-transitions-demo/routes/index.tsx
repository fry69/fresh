export default function Home() {
  return (
    <div class="h-screen bg-gray-100 flex flex-col items-center justify-center">
      <div class="w-full max-w-md mx-auto bg-white rounded-lg shadow-md p-8">
        <h1 class="text-4xl font-bold text-gray-800 mb-4">Page 1</h1>
        <p class="text-gray-600 mb-6">
          This is the first page. Click the link to navigate to the next page
          with a view transition.
        </p>
        <a
          href="/page/2"
          class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Go to Page 2
        </a>
      </div>
    </div>
  );
}
