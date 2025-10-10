# AI Stupid Meter - Web Frontend

🚀 **The World's First AI Intelligence Degradation Detection System**

A Next.js-based web application that provides real-time monitoring and analysis of AI model performance, featuring advanced degradation detection, intelligent routing, and comprehensive analytics.

## 🌟 Live Demo

- **Website**: [https://aistupidlevel.info](https://aistupidlevel.info)
- **Hugging Face Space**: [https://huggingface.co/spaces/AIStupidLevel/](https://huggingface.co/spaces/AIStupidLevel/)
- **Community**: [r/AIStupidLevel](https://www.reddit.com/r/AIStupidlevel)

## 🚀 Key Features

### 🔬 **Intelligence Monitoring**
- **Real-time AI model performance tracking** across 25+ models
- **7-axis scoring methodology** (Correctness, Spec Compliance, Code Quality, Efficiency, Stability, Refusal Rate, Recovery)
- **Dual-benchmark system**: Speed tests (hourly) + Deep reasoning (daily)
- **Statistical degradation detection** using CUSUM algorithms and Mann-Whitney U tests
- **Confidence intervals** and reliability badges for performance consistency

### 🧠 **Model Intelligence Center**
- **Advanced analytics engine** with 29 warning categories across 5 detection types
- **Smart recommendations** for best coding models, most reliable, and fastest response
- **Proactive alerts** for performance degradation and cost-efficiency issues
- **Provider trust scores** tracking reliability across all AI providers
- **Drift incident monitoring** with real-time notifications

### 🔧 **Revolutionary Tool Calling Evaluation**
- **World-first tool calling benchmarks** testing real system command execution
- **Multi-step workflow evaluation** in secure sandbox environments
- **171+ successful tool calling sessions** demonstrating practical AI capabilities
- **Real-world task completion** beyond simple text generation

### 🎯 **AI Router Pro**
- **Intelligent model routing** based on real-time performance data
- **Cost optimization** with automatic provider switching
- **Degradation protection** preventing use of poorly performing models
- **One unified API** for accessing multiple AI providers
- **Enterprise-grade reliability** with 99.9% uptime SLA

### 📊 **Advanced Analytics**
- **Historical performance tracking** with 24h, 7d, and 1m views
- **Interactive charts** with confidence intervals and error bars
- **Performance matrix** with reliability scoring
- **Trend analysis** and change point detection
- **Real-time ticker tape** with live performance updates

### 🔐 **Authentication & Subscriptions**
- **NextAuth.js integration** with OAuth providers
- **Stripe subscription management** with Pro features
- **User dashboard** with personalized settings
- **API key testing** for transparency and verification

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- Backend API running (see [aistupidmeter-api](https://github.com/StudioPlatforms/aistupidmeter-api))

## 🛠️ Installation

1. Clone the repository:
```bash
git clone https://github.com/StudioPlatforms/aistupidmeter-web.git
cd aistupidmeter-web
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.local.template .env.local
# Edit .env.local with your configuration
```

Required environment variables:
```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret
DATABASE_URL=your-database-url
API_BASE_URL=http://localhost:4000
```

4. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## 📦 Available Scripts

- `npm run dev` - Start the development server
- `npm run build` - Build the production application
- `npm run start` - Start the production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

## 🏗️ Tech Stack

### **Core Framework**
- **Next.js 14** with App Router
- **React 18** with Server Components
- **TypeScript** for type safety
- **Tailwind CSS** for styling

### **Authentication & Payments**
- **NextAuth.js** for authentication
- **Stripe** for subscription management
- **OAuth providers** (GitHub, Google)

### **Data & State Management**
- **React Query** for server state
- **Zustand** for client state
- **PostgreSQL** with Drizzle ORM

### **UI & Visualization**
- **Recharts** for interactive charts
- **Framer Motion** for animations
- **Vintage CRT aesthetic** with custom CSS
- **Responsive design** for mobile/desktop

### **Performance & Monitoring**
- **Redis caching** for optimized performance
- **Real-time updates** with Server-Sent Events
- **Error tracking** and performance monitoring
- **SEO optimization** with metadata

## 🎨 Design Philosophy

The application features a unique **vintage terminal aesthetic** inspired by 1980s computer terminals:
- **Phosphor green** color scheme
- **CRT monitor styling** with scan lines
- **Monospace fonts** for technical authenticity
- **Retro animations** and loading states
- **Terminal-style interfaces** for advanced users

## 🔌 API Integration

The frontend integrates with multiple backend services:

### **Main API Endpoints**
- `/dashboard/cached` - Cached dashboard data for instant loading
- `/dashboard/scores` - Real-time model scores
- `/analytics/*` - Advanced analytics and recommendations
- `/models/*` - Individual model details and history

### **Router API**
- `/router/*` - AI Router Pro functionality
- `/router/analytics` - Router performance metrics
- `/router/keys` - API key management

### **Authentication API**
- `/api/auth/*` - NextAuth.js endpoints
- `/api/subscription/*` - Stripe subscription management

## 📱 Mobile Optimization

- **Responsive design** that works on all screen sizes
- **Touch-friendly interfaces** for mobile users
- **Optimized performance** for slower connections
- **Progressive Web App** features
- **Mobile-specific navigation** and layouts

## 🔗 Related Repositories

- [AI Stupid Meter API](https://github.com/StudioPlatforms/aistupidmeter-api) - Backend API server
- [Hugging Face Space](https://huggingface.co/spaces/AIStupidLevel/) - Interactive demo

## 🌍 Community

- **Reddit**: [r/AIStupidLevel](https://www.reddit.com/r/AIStupidlevel) - Community discussions
- **X/Twitter**: [@AIStupidlevel](https://x.com/AIStupidlevel) - Latest updates
- **GitHub Discussions** - Technical discussions and feature requests

## 📝 License

MIT License - see LICENSE file for details

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### **Development Workflow**
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Make your changes and test thoroughly
4. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
5. Push to the branch (`git push origin feature/AmazingFeature`)
6. Open a Pull Request

### **Code Standards**
- Follow TypeScript best practices
- Use ESLint and Prettier for code formatting
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed

## 📧 Contact

**Built by:** Laurent @ StudioPlatforms

- **X/Twitter:** [@goatgamedev](https://x.com/goatgamedev)
- **Email:** laurent@studio-blockchain.com
- **GitHub:** [StudioPlatforms](https://github.com/StudioPlatforms)
- **Website:** [https://studioplatforms.eu](https://studioplatforms.eu)

## 🙏 Acknowledgments

- **OpenAI, Anthropic, Google, xAI** for providing AI model APIs
- **Vercel** for hosting and deployment
- **Stripe** for payment processing
- **Community contributors** for feedback and improvements

---

**Project Links:**
- **Repository**: [https://github.com/StudioPlatforms/aistupidmeter-web](https://github.com/StudioPlatforms/aistupidmeter-web)
- **Live Site**: [https://aistupidlevel.info](https://aistupidlevel.info)
- **Demo**: [https://huggingface.co/spaces/AIStupidLevel/](https://huggingface.co/spaces/AIStupidLevel/)

*Last Updated: October 2025*
