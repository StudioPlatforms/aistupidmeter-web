import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';

const DB_PATH = process.env.DATABASE_URL || '/root/data/stupid_meter.db';

export async function GET() {
  try {
    const db = new Database(DB_PATH);
    
    try {
      // Count total users
      const totalUsers = db.prepare('SELECT COUNT(*) as count FROM router_users').get() as { count: number };
      
      // Count users with Pro subscriptions (trial or active)
      const proUsers = db.prepare(`
        SELECT COUNT(*) as count 
        FROM router_users 
        WHERE subscription_tier = 'pro'
      `).get() as { count: number };
      
      // Count users created today
      const todayUsers = db.prepare(`
        SELECT COUNT(*) as count 
        FROM router_users 
        WHERE DATE(created_at) = DATE('now')
      `).get() as { count: number };
      
      // Count users created in last 7 days
      const weekUsers = db.prepare(`
        SELECT COUNT(*) as count 
        FROM router_users 
        WHERE created_at >= datetime('now', '-7 days')
      `).get() as { count: number };
      
      // Count users created in last 30 days
      const monthUsers = db.prepare(`
        SELECT COUNT(*) as count 
        FROM router_users 
        WHERE created_at >= datetime('now', '-30 days')
      `).get() as { count: number };
      
      return NextResponse.json({
        success: true,
        data: {
          total: totalUsers.count,
          pro: proUsers.count,
          free: totalUsers.count - proUsers.count,
          today: todayUsers.count,
          week: weekUsers.count,
          month: monthUsers.count
        }
      });
    } finally {
      db.close();
    }
  } catch (error) {
    console.error('Failed to fetch user stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch user stats' },
      { status: 500 }
    );
  }
}
