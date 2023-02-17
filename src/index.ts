import { COOKIE } from "./cookie";

/**
 * NGA需要登录才能查看大部分信息，所以需要你填写登录后的Cookie值
 */
const PARA = {
  "headers": {
    "accept": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36",
    "Cookie": COOKIE
  }
};

const STORAGE_KEY = "ankoThread";//存储用的key，没有特殊需求不必改
const DOMAIN_NAME = "ngabbs.com";//nga的域名，要是某个域名崩了，你可以在这里换其他的域名

const HELP = `<尖括号内为必填参数，写的时候不带尖括号>
[方括号内为可选参数，写的时候不带方括号]
# 后面为注释，解释命令的作用
.安科可以用.anko替代

.安科 吞楼检查 [第几页] [帖子tid]
# 默认为最新页，tid默认为你使用“记录”添加的内容

.安科 记录 <帖子tid>
# 记录帖子的tid，每人只有一个记录位

.安科 我的帖子
# 查看自己已经记录的帖子的链接

.安科 停留时间 [第几页]
# 默认查看帖子在首页停留时间

.安科 查询 [帖子tid]
#查询帖子详细信息，默认使用已保存的tid
`;

function queryTid(ext:seal.ExtInfo,qq:string) {
  const data: { [qq: string]: number[] } = JSON.parse(ext.storageGet(STORAGE_KEY) || '{}');
  let tid = -1;
  if (qq in data && data[qq].length > 0) {
    //如果存在记录，则获取
    tid = data[qq][0];
  }
  return tid;
}

function main() {
  // 注册扩展
  let ext = seal.ext.find('ankoThread');
  if (!ext) {
    ext = seal.ext.new('ankoThread', '憧憬少', '1.1.0');
    seal.ext.register(ext);
  }

  // 编写指令
  const cmdSeal = seal.ext.newCmdItemInfo();
  cmdSeal.name = '安科';
  cmdSeal.help = HELP;

  cmdSeal.solve = (ctx, msg, cmdArgs) => {
    try {
      let subCmd = cmdArgs.getArgN(1);
      switch (subCmd) {
        
        case '吞楼检查': {

          let page = '';
          let tid = -1;
          switch (cmdArgs.args.length) {
            case 1://没有tid，就查询tid，page=e
              tid = queryTid(ext, msg.sender.userId);
              page = "e";
              if (tid === -1) {
                seal.replyToSender(ctx, msg, `<${msg.sender.nickname}>既没有输入tid，也没有存储tid，找不到帖子哦`);
                return seal.ext.newCmdExecuteResult(false);
              }
              break;
            case 2://只有页数
              tid = queryTid(ext, msg.sender.userId);
              page = cmdArgs.getArgN(2);
              if (tid === -1) {
                seal.replyToSender(ctx, msg, `<${msg.sender.nickname}>既没有输入tid，也没有存储tid，找不到帖子哦`);
                return seal.ext.newCmdExecuteResult(false);
              }
              break;
            case 3:
              page = cmdArgs.getArgN(2);
              tid = Number(cmdArgs.getArgN(3));
              break;
            default:
              seal.replyToSender(ctx, msg, `缺少页数和帖子tid`);
              return seal.ext.newCmdExecuteResult(false);
          }

          const url = `https://${DOMAIN_NAME}/read.php?tid=${tid}&page=${page}`;
          const queryUrl = `${url}&__output=11`;

          seal.replyToSender(ctx, msg, `正在访问${url}，检查其${page === "e" ? "最新" : "第" + page}页的吞楼情况，请稍候`);
          fetch(queryUrl, PARA).then(response => {
            try {
              if (!response.ok) {
                seal.replyToSender(ctx, msg, `访问失败，响应状态码为：${response.status}`);
                return seal.ext.newCmdExecuteResult(false);
              }
              response.json().then(data => {
                data = data['data'];
                const page_rows = data['__R__ROWS_PAGE'];//一页本来应该拥有的楼层数，一般是20
                const total_rows = data['__R__ROWS'];//这一页实际显示出来的楼层数
                const missingList: number[] = [];
                const replies = data['__R'];
                const curPage = Math.floor(Number(replies[0]['lou']) / page_rows) + 1;
                if (total_rows !== page_rows) {
                  //存在吞楼现象
                  const startLevel = (Number(curPage) - 1) * 20;//本页起始楼层
                  const endLevel = startLevel + page_rows;//下一页起始楼层
                  let level = startLevel;//当前对比到的楼层，代表着本应该出现的楼层
                  
                  for (let reply of replies) {
                    let curLevel: number = reply['lou'];//当前回复的楼层数
                    while (curLevel != level && level < endLevel) {
                      //出现吞楼现象
                      missingList.push(level);
                      ++level;//检查下一个应该出现的楼层
                    }
                    //没有吞楼
                    ++level;
                  }
                  
                }

                const thread = data['__T'];
                const title = thread['subject'];
                const author = thread['author'];
                seal.replyToSender(ctx, msg, `标题:${title}\n链接:${url}\n作者:${author}\n页数：${curPage}\n被吞${missingList.length}层：${missingList.join(',')}`);
                return seal.ext.newCmdExecuteResult(true);
              })
              return seal.ext.newCmdExecuteResult(true);
            } catch (error) {
              seal.replyToSender(ctx, msg, error.message);
              return seal.ext.newCmdExecuteResult(false);
            }
            
          })
          return seal.ext.newCmdExecuteResult(true);
        }
        case '记录': {
          const data: {[qq:string]:number[]} = JSON.parse(ext.storageGet(STORAGE_KEY) || '{}');
          const tid = Number(cmdArgs.getArgN(2));
          const qq = msg.sender.userId;
          //如果没有记录就新建
          if (data[qq] === undefined) {
            data[qq] = [];
          }
          //之所以定义为列表只是为了方便以后扩展，目前还是每人一个存档位
          if (data[qq].length > 0) {
            //已经有的就清空
            data[qq].splice(0, data[qq].length);
          }
          //存储
          data[qq].push(tid);
          ext.storageSet(STORAGE_KEY, JSON.stringify(data))
          seal.replyToSender(ctx, msg, `已为<${msg.sender.nickname}>记录帖子tid，完整链接为：https://${DOMAIN_NAME}/read.php?tid=${tid}`);
          return seal.ext.newCmdExecuteResult(true);
        }
        case '我的帖子': {
          let tid = queryTid(ext,msg.sender.userId);
          if (tid === -1) {
            seal.replyToSender(ctx, msg, `<${msg.sender.nickname}>还没有记录任何帖子的tid`);
          } else {
            seal.replyToSender(ctx, msg, `<${msg.sender.nickname}>的安科帖：https://${DOMAIN_NAME}/read.php?tid=${tid}`);
          }
          return seal.ext.newCmdExecuteResult(true);
        }
        case '停留时间': {
          let page = 1;//默认为首页
          if (cmdArgs.args.length >= 2) {
            page = Number(cmdArgs.getArgN(2));
          }
          seal.replyToSender(ctx, msg, `正在查询，请稍候`);
          fetch(`https://${DOMAIN_NAME}/thread.php?fid=784&page=${page}&__output=11`,PARA).then(response => {
            
              if (!response.ok) {
                seal.replyToSender(ctx, msg, `访问失败，响应状态码为：${response.status}`);
                return seal.ext.newCmdExecuteResult(false);
              }
              response.json().then(data => {
                data = data['data'];
                try {
                  const threads = data['__T'];
                  let detentionTime = -1;//滞留时间，单位为分钟
                  for (let i = threads.length-1; i >= 0; --i){
                    const thread = threads[i];
                    if(thread['recommend'] > 0) {
                      continue;//如果加精华了，就跳过，因为这不是准确的首页停留时间
                    }
                    let now = new Date();
                    let lastpost = new Date(Number(thread['lastpost']));
                    let time = now.getTime() - lastpost.getTime()*1000;
                    detentionTime = Math.floor(time / (60 * 1000));
                    break;
                  }

                  if (detentionTime === -1) {
                    seal.replyToSender(ctx, msg, `出错了，没能计算出来`);
                    return seal.ext.newCmdExecuteResult(false);
                  } else {
                    seal.replyToSender(ctx, msg, `刚更新的安科帖可以在前${page}页停留${detentionTime}分钟`);
                    return seal.ext.newCmdExecuteResult(true);
                    }
                } catch (error) {
                  seal.replyToSender(ctx, msg, error.message);
                  return seal.ext.newCmdExecuteResult(false);
                }
              })
              return seal.ext.newCmdExecuteResult(true);
            
          });
          return seal.ext.newCmdExecuteResult(true);
        }
        case '查询': {
          let tid = Number(cmdArgs.getArgN(2));
          if (!tid) {
            tid = queryTid(ext,msg.sender.userId);
          }
          
          if (tid === -1) {
            seal.replyToSender(ctx, msg, `<${msg.sender.nickname}>还没有记录任何帖子的tid，也没有传入tid`);
          } else {
            const url = `https://${DOMAIN_NAME}/read.php?tid=${tid}`;
            const queryUrl = `${url}&__output=11`;
            seal.replyToSender(ctx, msg, `正在查询${url}，请稍候`);
            fetch(queryUrl, PARA).then(response => {
              try {
                if (!response.ok) {
                  seal.replyToSender(ctx, msg, `访问失败，响应状态码为：${response.status}`);
                  return seal.ext.newCmdExecuteResult(false);
                }
                response.json().then(data => {
                  try {
                    data = data['data'];

                    const thread = data['__T'];
                    const title = thread['subject'];
                    const author = thread['author'];
                    const replies = thread['replies'];
                    const postdate = thread['postdate'];
                    const lastpost = thread['lastpost'];
                    let cover = '';
                    // const attachs = thread?.post_misc_var?.attachs;
                    // if (attachs) {
                    //   // cover = `[CQ:image,file=https://img.nga.178.com/attachments/${attachs[0]['attachurl']},cache=0]`
                    //   cover = JSON.stringify(attachs);
                    // }
                    
                    seal.replyToSender(ctx, msg, `标题：${title}\n链接：${url}\n${cover}\n作者：${author}\n楼层：${replies}\n发布时间：${new Date(postdate * 1000).toLocaleString()}\n最后回复：${new Date(lastpost * 1000).toLocaleString()}`);
                    return seal.ext.newCmdExecuteResult(false);
                  } catch (error) {
                    seal.replyToSender(ctx, msg, error.message);
                    return seal.ext.newCmdExecuteResult(false);
                  }
                })
                return seal.ext.newCmdExecuteResult(true);
              } catch (error) {
                seal.replyToSender(ctx, msg, error.message);
                return seal.ext.newCmdExecuteResult(false);
              }
            })
          }
          return seal.ext.newCmdExecuteResult(true);
        }
        case 'help':
        default:{
          const ret = seal.ext.newCmdExecuteResult(true);
          ret.showHelp = true;
          return ret;
        }
      }
    } catch (error) {
      seal.replyToSender(ctx, msg, error.message);
      return seal.ext.newCmdExecuteResult(false);
    }
  }

  // 注册命令
  ext.cmdMap['安科'] = cmdSeal;
  ext.cmdMap['anko'] = cmdSeal;
}

main();
