const API = "http://localhost:8000/api";
const API_BASE = "http://localhost:8000";
const token = () => localStorage.getItem("token");

// Общий обработчик ошибок
async function api(path, opts = {}) {
    const headers = { ...(opts.headers || {}) };
    if (token()) headers["Authorization"] = `Bearer ${token()}`;
    if (opts.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
    const res = await fetch(API + path, { ...opts, headers });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Ошибка" }));
        throw new Error(err.detail || "Ошибка сервера");
    }
    return res.json();
}

function logout() { localStorage.clear(); window.location.href = "index.html"; }

// --- АВТОРИЗАЦИЯ ---
async function login() {
    const body = new URLSearchParams({ username: document.getElementById("email").value, password: document.getElementById("password").value });
    try {
        const res = await fetch(`${API}/users/login`, { method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body });
        if (!res.ok) throw new Error("Неверный логин или пароль");
        const data = await res.json();
        localStorage.setItem("token", data.access_token);
        if (data.is_admin) localStorage.setItem("isAdmin", "true");
        window.location.href = data.is_admin ? "admin.html" : "index.html";
    } catch (e) { alert(e.message); }
}

async function register() {
    const email = document.getElementById("regEmail").value;
    const password = document.getElementById("regPassword").value;
    const confirmPassword = document.getElementById("regPasswordConfirm").value; // <-- Берем подтверждение

    // Проверки перед отправкой
    if (!email || !password) {
        return alert("Заполните все поля!");
    }
    if (password !== confirmPassword) {
        return alert("Пароли не совпадают! Проверьте ввод.");
    }
    if (password.length < 6) {
        return alert("Пароль должен быть не менее 6 символов!");
    }

    try {
        const res = await fetch(`${API}/users/register`, { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({email, password}) 
        });
        if (!res.ok) throw new Error("Ошибка регистрации (возможно, почта занята)");
        alert("Успешно! Теперь войдите.");
        
        // Очищаем поля после успеха
        document.getElementById("regEmail").value = "";
        document.getElementById("regPassword").value = "";
        document.getElementById("regPasswordConfirm").value = "";
    } catch (e) { 
        alert(e.message); 
    }
}
// --- КАТАЛОГ И КОРЗИНА ---
async function loadProducts() {
    const res = await fetch(`${API}/products/`);
    const products = await res.json();
    const grid = document.getElementById("productsGrid");
    if(!grid) return;
    grid.innerHTML = products.map(p => `
        <div class="card">
            <!-- Используем API_BASE для загрузки картинки с бэкенда -->
            <img src="${p.image_url ? API_BASE + p.image_url : 'https://via.placeholder.com/300'}" alt="">
            <div class="card-info">
                <h3>${p.name}</h3>
                <div class="card-price">${p.price} ₽</div>
                <button class="btn" onclick="addToCart(${p.id})">В корзину</button>
            </div>
        </div>
    `).join("");
}

function addToCart(id) {
    let cart = JSON.parse(localStorage.getItem("cart") || "[]");
    cart.push(id);
    localStorage.setItem("cart", JSON.stringify(cart));
    updateCartCount(); alert("Добавлено!");
}

function updateCartCount() {
    const count = JSON.parse(localStorage.getItem("cart") || "[]").length;
    const el = document.getElementById("cartCount");
    if (el) el.innerText = count;
}

async function renderCart() {
    const cart = JSON.parse(localStorage.getItem("cart") || "[]");
    const res = await fetch(`${API}/products/`);
    const allProducts = await res.json();
    
    const container = document.getElementById("cartItems");
    if(!container) return;

    if (cart.length === 0) {
        container.innerHTML = `<p style="text-align:center; padding:20px;">Корзина пуста</p>`;
        document.getElementById("total").innerText = 0;
        return;
    }

    // Группируем товары по ID
    const groupedCart = {};
    cart.forEach(id => {
        groupedCart[id] = (groupedCart[id] || 0) + 1;
    });

    let total = 0;
    let html = "";

    // Проходимся по сгруппированным данным
    for (const [id, quantity] of Object.entries(groupedCart)) {
        const product = allProducts.find(p => p.id == id);
        if (!product) continue; // Если товар удалили из базы
        
        const itemTotal = product.price * quantity;
        total += itemTotal;

        html += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:15px; border-bottom:1px solid #eee;">
                <div>
                    <span style="font-weight:bold;">${product.name}</span>
                    <span style="color:#D84315; margin-left:10px;">${quantity} шт.</span>
                </div>
                <div>
                    <span>${itemTotal} ₽</span>
                    <button class="btn" style="padding:5px 10px; margin-left:15px; background:#d32f2f;" onclick="removeFromCart(${id})">×</button>
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
    document.getElementById("total").innerText = total;
}

// Функция удаления одной позиции из корзины
function removeFromCart(id) {
    let cart = JSON.parse(localStorage.getItem("cart") || "[]");
    const index = cart.indexOf(id);
    if (index > -1) {
        cart.splice(index, 1); // Удаляем только один экземпляр
        localStorage.setItem("cart", JSON.stringify(cart));
        renderCart(); // Перерисовываем
        updateCartCount();
    }
}

async function checkout() {
    if (!token()) return window.location.href = "login.html";
    const cart = JSON.parse(localStorage.getItem("cart") || "[]");
    if (!cart.length) return alert("Корзина пуста");

    try {
        const order = await api("/orders/", { method: "POST", body: JSON.stringify({ product_ids: cart }) });

        // Генерация чека
        document.getElementById("receiptText").innerText = `Заказ №${order.order_id}\nСумма: ${order.total} ₽\nСпасибо за покупку!`;
        document.getElementById("receiptBox").style.display = "block";
        document.querySelector("button[onclick='checkout()']").style.display = "none";

        localStorage.removeItem("cart");
        updateCartCount();
    } catch (e) { alert(e.message); }
}

// --- ЛИЧНЫЙ КАБИНЕТ ---
async function loadMyOrders() {
    if (!token()) return window.location.href = "login.html";
    const list = document.getElementById("ordersList");
    try {
        const orders = await api("/orders/my");
        
        if(orders.length === 0) {
            list.innerHTML = "<p>У вас пока нет заказов.</p>";
            return;
        }

        list.innerHTML = orders.map(o => {
            // Формируем список товаров
            const itemsHtml = o.items.map(item => `
                <div style="font-size:14px; color:#555; margin-left: 20px;">
                    • ${item.product_name} — ${item.quantity} шт. (${item.price * item.quantity} ₽)
                </div>
            `).join("");

            return `
            <div style="background:#fff; padding:15px; margin-bottom:15px; border-radius:8px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                <div style="display:flex; justify-content:space-between; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 10px;">
                    <b>Заказ №${o.id}</b>
                    <span>${new Date(o.created_at).toLocaleString()}</span>
                    <b>${o.total} ₽</b>
                </div>
                ${itemsHtml}
            </div>
            `;
        }).join("");
    } catch(e) { list.innerHTML = "Ошибка загрузки"; }
}

// --- АДМИНКА ---
let editProdId = null;
let editBlogId = null;

async function adminTab(tab) {
    const content = document.getElementById("adminContent");
    if (!content) return;

    editProdId = null;
    editBlogId = null;

    if (tab === 'stats') {
        // Получаем сегодняшнюю дату для дефолтного значения
        const today = new Date().toISOString().split('T')[0];
        const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        content.innerHTML = `
            <h3>Статистика</h3>
            
            <!-- Панель выбора дат -->
            <div style="display:flex; gap:10px; align-items:center; margin-bottom:20px; background:#f5f5f5; padding:15px; border-radius:8px;">
                <label>С:</label>
                <input type="date" id="statsStart" value="${lastWeek}" style="padding:8px; border:1px solid #ccc; border-radius:5px;">
                <label>По:</label>
                <input type="date" id="statsEnd" value="${today}" style="padding:8px; border:1px solid #ccc; border-radius:5px;">
                <button class="btn" onclick="loadStatsRange()">Показать</button>
            </div>

            <p>Всего заказов за все время: <b id="statsTotalOrders">-</b></p>
            <p>Общая выручка: <b id="statsRevenue">-</b> ₽</p>
            
            <canvas id="chart" style="margin-top:20px; max-height:300px;"></canvas>
        `;
        
        // Первичная загрузка (за последнюю неделю)
        loadStatsRange();
    }
    else if (tab === 'products') {
        content.innerHTML = `
            <h3 id="prodFormTitle">Добавить товар</h3>
            <input type="text" id="pName" placeholder="Название" style="width:100%; padding:10px; margin-bottom:10px; border:1px solid #ccc;">
            <input type="number" id="pPrice" placeholder="Цена" style="width:100%; padding:10px; margin-bottom:10px; border:1px solid #ccc;">
            <input type="text" id="pDesc" placeholder="Описание" style="width:100%; padding:10px; margin-bottom:10px; border:1px solid #ccc;">
            <label style="display:block; margin-bottom:5px;">Картинка (оставьте пустым, чтобы не менять):</label>
            <input type="file" id="pFile" accept="image/*" style="width:100%; padding:10px; margin-bottom:10px; border:1px solid #ccc;">

            <div style="display:flex; gap:10px; margin-bottom: 30px;">
                <button class="btn" onclick="saveProd()">Сохранить</button>
                <button class="btn" style="background:#555; display:none;" id="cancelProdBtn" onclick="adminTab('products')">Отмена</button>
            </div>

            <h3>Список товаров</h3>
            <table style="width:100%; text-align:left;">
                <tr><th>ID</th><th>Название</th><th>Цена</th><th>Действия</th></tr>
                <tbody id="prodTableBody"></tbody>
            </table>
        `;
        loadAdminProducts();
    }
    else if (tab === 'blogs') {
        content.innerHTML = `
            <h3 id="blogFormTitle">Написать статью</h3>
            <input type="text" id="blogTitle" placeholder="Заголовок статьи" style="width:100%; padding:10px; margin-bottom:10px; border:1px solid #ccc;">
            <textarea id="blogContent" placeholder="Текст статьи..." style="width:100%; padding:10px; margin-bottom:10px; border:1px solid #ccc; min-height: 150px;"></textarea>

            <div style="display:flex; gap:10px; margin-bottom: 30px;">
                <button class="btn" onclick="saveBlog()">Опубликовать</button>
                <button class="btn" style="background:#555; display:none;" id="cancelBlogBtn" onclick="adminTab('blogs')">Отмена</button>
            </div>

            <h3>Список статей</h3>
            <table style="width:100%; text-align:left;">
                <tr><th>ID</th><th>Заголовок</th><th>Дата</th><th>Действия</th></tr>
                <tbody id="blogTableBody"></tbody>
            </table>
        `;
        loadAdminBlogs();
    }
    else if (tab === 'orders') {
        const orders = await api("/admin/orders");
        
        if(orders.length === 0) {
            content.innerHTML = "<h3>Заказы</h3><p>Заказов пока нет.</p>";
            return;
        }

        content.innerHTML = `
            <h3>Все заказы</h3>
            <div style="display:flex; flex-direction:column; gap:15px; margin-top:20px;">
            ${orders.map(o => `
                <div style="background:#f9f9f9; padding:15px; border-radius:8px; border:1px solid #eee;">
                    <div style="display:flex; justify-content:space-between; font-weight:bold; margin-bottom:10px;">
                        <span>Заказ №${o.id}</span>
                        <span>${o.total} ₽</span>
                    </div>
                    <div style="font-size:12px; color:#888; margin-bottom:10px;">${new Date(o.created_at).toLocaleString()}</div>
                    ${o.items.map(item => `
                        <div style="font-size:14px; margin-left:10px;">
                            • ${item.product_name} — ${item.quantity} шт.
                        </div>
                    `).join("")}
                </div>
            `).join("")}
            </div>
        `;
    }
}

// --- ЛОГИКА ТОВАРОВ ---
async function loadAdminProducts() {
    const tbody = document.getElementById("prodTableBody");
    const products = await api("/products/");
    tbody.innerHTML = products.map(p => `
        <tr style="border-bottom: 1px solid #eee;">
            <td style="padding:10px;">${p.id}</td>
            <td style="padding:10px;">${p.name}</td>
            <td style="padding:10px;">${p.price} ₽</td>
            <td style="padding:10px;">
                <button class="btn" style="padding:5px 10px; margin-right:5px;" onclick="editProd(${p.id}, '${p.name}', ${p.price}, '${p.description || ''}')">✏️</button>
                <button class="btn" style="padding:5px 10px; background:#d32f2f;" onclick="deleteProd(${p.id})">🗑️</button>
            </td>
        </tr>
    `).join("");
}

function editProd(id, name, price, desc) {
    editProdId = id;
    document.getElementById("prodFormTitle").innerText = "Редактировать товар #" + id;
    document.getElementById("pName").value = name;
    document.getElementById("pPrice").value = price;
    document.getElementById("pDesc").value = desc;
    document.getElementById("pFile").value = "";
    document.getElementById("cancelProdBtn").style.display = "inline-block";
}

async function saveProd() {
    const formData = new FormData();
    formData.append("name", document.getElementById("pName").value);
    formData.append("price", parseFloat(document.getElementById("pPrice").value));
    formData.append("description", document.getElementById("pDesc").value);
    const fileInput = document.getElementById("pFile");
    if (fileInput.files.length > 0) formData.append("file", fileInput.files[0]);

    const url = editProdId ? `${API}/admin/products/${editProdId}` : `${API}/admin/products`;
    const method = editProdId ? "PUT" : "POST";

    try {
        const res = await fetch(url, {
            method: method,
            headers: { "Authorization": `Bearer ${token()}` },
            body: formData
        });
        if (!res.ok) throw new Error("Ошибка сохранения");
        alert("Сохранено!");
        adminTab('products'); // Перезагружаем вкладку
    } catch (e) { alert(e.message); }
}

async function deleteProd(id) {
    if (!confirm("Удалить товар?")) return;
    await api(`/admin/products/${id}`, { method: "DELETE" });
    loadAdminProducts();
}

// --- ЛОГИКА БЛОГОВ ---
async function loadAdminBlogs() {
    const tbody = document.getElementById("blogTableBody");
    const posts = await api("/blog/");
    tbody.innerHTML = posts.map(p => `
        <tr style="border-bottom: 1px solid #eee;">
            <td style="padding:10px;">${p.id}</td>
            <td style="padding:10px;">${p.title}</td>
            <td style="padding:10px;">${new Date(p.created_at).toLocaleDateString()}</td>
            <td style="padding:10px;">
                <button class="btn" style="padding:5px 10px; margin-right:5px;" onclick="editBlog(${p.id}, '${p.title}', \`${p.content}\`)">✏️</button>
                <button class="btn" style="padding:5px 10px; background:#d32f2f;" onclick="deleteBlog(${p.id})">🗑️</button>
            </td>
        </tr>
    `).join("");
}

function editBlog(id, title, content) {
    editBlogId = id;
    document.getElementById("blogFormTitle").innerText = "Редактировать статью #" + id;
    document.getElementById("blogTitle").value = title;
    document.getElementById("blogContent").value = content;
    document.getElementById("cancelBlogBtn").style.display = "inline-block";
}

async function saveBlog() {
    const title = document.getElementById("blogTitle").value;
    const content = document.getElementById("blogContent").value;
    if(!title || !content) return alert("Заполните все поля!");

    const url = editBlogId ? `/admin/blog/${editBlogId}` : `/admin/blog`;
    const method = editBlogId ? "PUT" : "POST";

    try {
        await api(url, { method: method, body: JSON.stringify({ title, content }) });
        alert("Сохранено!");
        adminTab('blogs'); // Перезагружаем вкладку
    } catch (e) { alert(e.message); }
}

async function deleteBlog(id) {
    if (!confirm("Удалить статью?")) return;
    await api(`/admin/blog/${id}`, { method: "DELETE" });
    loadAdminBlogs();
}

// --- БЛОГ (Страница) ---
async function loadBlogs() {
    const container = document.getElementById("blogContainer");
    if (!container) return;

    try {
        const posts = await api("/blog/");

        if (posts.length === 0) {
            container.innerHTML = `<h2 class="section-title">Блог</h2><p style="text-align:center;">Пока нет ни одной статьи.</p>`;
            return;
        }

        container.innerHTML = `<h2 class="section-title">Блог</h2>` + posts.map(post => `
            <article class="post" style="position:relative; margin-bottom: 20px;" id="post-${post.id}">
                <h2>${post.title}</h2>
                <p style="color:#888; font-size:12px; margin-bottom:15px;">${new Date(post.created_at).toLocaleDateString()}</p>
                <p style="white-space: pre-wrap;">${post.content}</p>

                <!-- Стикер для этой статьи -->
                <div class="sticker" data-post-id="${post.id}">☕</div>
            </article>
        `).join("");

        // После того как статьи отрисовались, активируем стикеры
        initStickers();
    } catch (e) {
        container.innerHTML = `<p style="color:red;">Ошибка загрузки блога</p>`;
    }
}

// --- DRAG AND DROP (Стикеры) ---
function initStickers() {
    const stickers = document.querySelectorAll('.sticker');

    stickers.forEach(sticker => {
        const postId = sticker.getAttribute('data-post-id');

        // Восстанавливаем сохраненную позицию при загрузке
        const savedPos = JSON.parse(localStorage.getItem(`sticker-${postId}`));
        if (savedPos) {
            sticker.style.left = savedPos.left;
            sticker.style.top = savedPos.top;
        }

        // Логика перетаскивания
        let isDragging = false;
        let offsetX, offsetY;

        sticker.addEventListener('mousedown', (e) => {
            isDragging = true;
            sticker.style.cursor = 'grabbing';

            // Вычисляем, за какую точку стикера схватились
            offsetX = e.clientX - sticker.getBoundingClientRect().left;
            offsetY = e.clientY - sticker.getBoundingClientRect().top;

            sticker.style.zIndex = 1000;
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            // Получаем границы статьи, чтобы стикер не улетел за её пределы
            const parent = sticker.parentElement;
            const parentRect = parent.getBoundingClientRect();

            let newX = e.clientX - offsetX;
            let newY = e.clientY - offsetY;

            // Ограничиваем движение внутри статьи
            if (newX < parentRect.left) newX = parentRect.left;
            if (newX + sticker.offsetWidth > parentRect.right) newX = parentRect.right - sticker.offsetWidth;
            if (newY < parentRect.top) newY = parentRect.top;
            if (newY + sticker.offsetHeight > parentRect.bottom) newY = parentRect.bottom - sticker.offsetHeight;

            // Позиционируем относительно родителя (статьи)
            sticker.style.left = (newX - parentRect.left) + 'px';
            sticker.style.top = (newY - parentRect.top) + 'px';
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                sticker.style.cursor = 'grab';
                sticker.style.zIndex = 1;

                // Сохраняем позицию в localStorage
                const currentPos = {
                    left: sticker.style.left,
                    top: sticker.style.top
                };
                localStorage.setItem(`sticker-${postId}`, JSON.stringify(currentPos));
            }
        });
    });
}

// --- ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ ---
document.addEventListener("DOMContentLoaded", () => {
    updateCartCount();

    if (token()) {
        if(document.getElementById("authBtn")) document.getElementById("authBtn").style.display = "none";
        if(document.getElementById("logoutBtn")) document.getElementById("logoutBtn").style.display = "inline-block";
    }

    // Запускаем загрузку блога, если мы на странице блога
    if (window.location.pathname.includes("blog.html")) {
        loadBlogs();
    }
});

let currentStatsChart = null; // Глобальная переменная для графика

async function loadStatsRange() {
    const start = document.getElementById("statsStart").value;
    const end = document.getElementById("statsEnd").value;

    if (!start || !end) return alert("Выберите обе даты!");

    try {
        const stats = await api(`/admin/stats?start_date=${start}&end_date=${end}`);
        
        // Обновляем текст
        document.getElementById("statsTotalOrders").innerText = stats.total_orders;
        document.getElementById("statsRevenue").innerText = stats.revenue;

        // Перерисовываем график
        if (currentStatsChart) currentStatsChart.destroy();

        currentStatsChart = new Chart(document.getElementById('chart'), {
            type: 'bar',
            data: { 
                labels: stats.labels, // Даты вида 01.11, 02.11...
                datasets: [{ 
                    label: 'Выручка (₽)', 
                    data: stats.chart_data, 
                    backgroundColor: '#D84315',
                    borderRadius: 6
                }] 
            },
            options: {
                scales: { y: { beginAtZero: true } },
                plugins: {
                    tooltip: {
                        callbacks: {
                            title: (items) => `Дата: ${items[0].label}` // Подсказка при наведении
                        }
                    }
                }
            }
        });
    } catch (e) {
        alert(e.message);
    }
}

// --- ГЛАЗИК ДЛЯ ПАРОЛЯ ---
function togglePassword(inputId, btnElement) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        btnElement.style.color = '#D84315'; 
    } else {
        input.type = 'password';
        btnElement.style.color = '#888';
    }
}