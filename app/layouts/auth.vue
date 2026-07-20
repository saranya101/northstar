<template>
  <div class="auth-shell">
    <div class="auth-shell__grid">
      <aside class="auth-shell__story" aria-label="About Northstar">
        <AuthBrand />
        <div class="auth-shell__statement">
          <h1>Know what matters before it becomes urgent.</h1>
          <p>Bring your modules, deadlines, study patterns and academic goals into one clear system.</p>
        </div>
        <AuthVisual class="auth-shell__visual" />
      </aside>

      <main class="auth-shell__panel-zone">
        <AuthPanel>
          <AuthModeTabs />
          <slot />
        </AuthPanel>
      </main>
    </div>
  </div>
</template>
