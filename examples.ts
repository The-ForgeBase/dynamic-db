import { DatabaseSDK } from "./src/sdk/client.js";

// Types for our examples
interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  department: string;
  salary: number;
  hireDate: Date;
}

interface Order {
  id: number;
  userId: number;
  total: number;
  status: string;
  createdAt: Date;
}

interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
  stock: number;
}

// Initialize SDK
const db = new DatabaseSDK("https://api.example.com");

// Basic Queries
async function basicQueries() {
  // Simple select with where clause
  const activeUsers = await db
    .table<User>("users")
    .where("status", "active")
    .execute();

  // Multiple conditions
  const seniorManagers = await db
    .table<User>("users")
    .where("role", "manager")
    .where("experience", ">=", 5)
    .execute();

  // Order by with nulls handling
  const sortedUsers = await db
    .table<User>("users")
    .orderBy("lastName", "asc", "last")
    .orderBy({ field: "salary", direction: "desc", nulls: "first" })
    .execute();

  // Pagination
  const pagedResults = await db
    .table<User>("users")
    .offset(20)
    .limit(10)
    .execute();
}

// Advanced Filtering
async function advancedFiltering() {
  // Complex grouped conditions
  const filteredUsers = await db
    .table<User>("users")
    .where("status", "active")
    .andWhere((query) => {
      query.where("role", "admin").orWhere((subQuery) => {
        subQuery.where("role", "manager").where("department", "IT");
      });
    })
    .execute();

  // Where between
  const salaryRange = await db
    .table<User>("users")
    .whereBetween("salary", [50000, 100000])
    .execute();

  // Where in
  const specificDepts = await db
    .table<User>("users")
    .whereIn("department", ["IT", "HR", "Finance"])
    .execute();

  // Where exists
  const usersWithOrders = await db
    .table<User>("users")
    .whereExists(
      "SELECT 1 FROM orders WHERE orders.user_id = users.id AND total > ?",
      [1000]
    )
    .execute();
}

// Aggregations and Grouping
async function aggregationsAndGrouping() {
  // Basic aggregation
  const orderStats = await db
    .table<Order>("orders")
    .groupBy("status")
    .count("id", "order_count")
    .sum("total", "total_amount")
    .avg("total", "average_amount")
    .execute();

  // Having clause
  const highValueOrderGroups = await db
    .table<Order>("orders")
    .groupBy("userId")
    .having("total_amount", ">", 10000)
    .sum("total", "total_amount")
    .execute();

  // Multiple aggregations with complex grouping
  const detailedStats = await db
    .table<Order>("orders")
    .groupBy("department", "status")
    .count("id", "order_count")
    .sum("total", "revenue")
    .avg("total", "avg_order_value")
    .min("total", "min_order")
    .max("total", "max_order")
    .having("order_count", ">", 5)
    .orderBy("revenue", "desc")
    .execute();
}

// Window Functions
async function windowFunctions() {
  // Row number
  const rankedUsers = await db
    .table<User>("users")
    .rowNumber("rank", ["department"], [{ field: "salary", direction: "desc" }])
    .execute();

  // Multiple window functions
  const analyzedSalaries = await db
    .table<User>("users")
    .window("rank", "salary_rank", {
      partitionBy: ["department"],
      orderBy: [{ field: "salary", direction: "desc" }],
    })
    .window("lag", "prev_salary", {
      field: "salary",
      partitionBy: ["department"],
      orderBy: [{ field: "hireDate", direction: "asc" }],
    })
    .execute();

  // Advanced window function
  const advancedAnalysis = await db
    .table<User>("users")
    .windowAdvanced("sum", "running_total", {
      field: "salary",
      over: {
        partitionBy: ["department"],
        orderBy: [{ field: "hireDate", direction: "asc" }],
        frame: {
          type: "ROWS",
          start: "UNBOUNDED PRECEDING",
          end: "CURRENT ROW",
        },
      },
    })
    .execute();
}

// CTEs (Common Table Expressions)
async function cteExamples() {
  // Simple CTE
  const highPaidUsers = db.table<User>("users").where("salary", ">", 100000);

  const result = await db
    .table<User>("users")
    .with("high_paid", highPaidUsers)
    .execute();

  // Recursive CTE
  const initialQuery = db
    .table<Product>("products")
    .where("category", "Electronics");

  const recursiveQuery = db
    .table<Product>("products")
    .where("price", "<", 1000);

  const recursiveResult = await db
    .table<Product>("products")
    .withRecursive("product_hierarchy", initialQuery, recursiveQuery, {
      unionAll: true,
    })
    .execute();
}

// Transformations
async function transformations() {
  // Compute new fields
  const enrichedUsers = await db
    .table<User>("users")
    .compute({
      fullName: (row) => `${row.firstName} ${row.lastName}`,
      yearsEmployed: (row) =>
        new Date().getFullYear() - new Date(row.hireDate).getFullYear(),
    })
    .execute();

  // Pivot example
  const pivotedData = await db
    .table<Order>("orders")
    .pivot("status", ["pending", "completed", "cancelled"], {
      type: "count",
      field: "id",
    })
    .execute();
}

// Complex Real-World Examples
async function realWorldExamples() {
  // Sales analysis with multiple CTEs and window functions
  const monthlySales = db
    .table<Order>("orders")
    .groupBy("year", "month")
    .sum("total", "monthly_total");

  const departmentSales = db
    .table<Order>("orders")
    .groupBy("department")
    .sum("total", "dept_total");

  const analysis = await db
    .table<Order>("orders")
    .with("monthly", monthlySales)
    .with("dept_sales", departmentSales)
    .window("rank", "sales_rank", {
      partitionBy: ["department"],
      orderBy: [{ field: "total", direction: "desc" }],
    })
    .window("sum", "running_total", {
      field: "total",
      partitionBy: ["department"],
      orderBy: [{ field: "date", direction: "asc" }],
    })
    .where("status", "completed")
    .groupBy("department", "category")
    .having("total_sales", ">", 10000)
    .orderBy("total_sales", "desc", "last")
    .execute();
}
