import { useEffect } from "react";

function Home() {
  // This runs IMMEDIATELY when the file loads
  console.log("🔴 HOME FILE LOADED - THIS SHOULD ALWAYS SHOW");
  
  // This runs when component renders
  console.log("🟡 HOME COMPONENT RENDERING");

  useEffect(() => {
    console.log("🟢 HOME USEEFFECT RUNNING");
    console.log("URL:", window.location.href);
    console.log("Search:", window.location.search);
  }, []);

  return (
    <div style={{ padding: "20px" }}>
      <h1>🏠 HOME PAGE LOADED</h1>
      <p>If you see this text, the component is rendering</p>
      <p>Current URL: {window.location.href}</p>
      <p>Search params: {window.location.search}</p>
    </div>
  );
}

export default Home;