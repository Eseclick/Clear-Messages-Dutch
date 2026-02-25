import {api, opendiscord, utilities} from "#opendiscord"
import * as discord from "discord.js"

// DECLARATION
declare module "#opendiscord-types" {
    export interface ODPluginManagerIds_Default {
        "clear-messages":api.ODPlugin
    }
    export interface ODSlashCommandManagerIds_Default {
        "clear-messages:clear":api.ODSlashCommand
    }
    export interface ODTextCommandManagerIds_Default {
        "clear-messages:clear":api.ODTextCommand
    }
    export interface ODCommandResponderManagerIds_Default {
        "clear-messages:clear":{source:"slash"|"text",params:{},workers:"clear-messages:clear"|"clear-messages:logs"},
    }
    export interface ODMessageManagerIds_Default {
        "clear-messages:clear-message":{source:"slash"|"text"|"other",params:{author:discord.User,amount:number,custom:boolean},workers:"clear-messages:clear-message"},
        "clear-messages:error-message":{source:"slash"|"text"|"other",params:{error:string},workers:"clear-messages:error-message"},
    }
    export interface ODEmbedManagerIds_Default {
        "clear-messages:clear-embed":{source:"slash"|"text"|"other",params:{author:discord.User,amount:number,custom:boolean},workers:"clear-messages:clear-embed"},
        "clear-messages:error-embed":{source:"slash"|"text"|"other",params:{error:string},workers:"clear-messages:error-embed"},
    }
}

// REGISTER SLASH COMMAND
opendiscord.events.get("onSlashCommandLoad").listen((slash) => {
    slash.add(new api.ODSlashCommand("clear-messages:clear",{
        name:"clear-messages",
        description:"Schoon X-aantal berichten op in dit kanaal",
        type:discord.ApplicationCommandType.ChatInput,
        contexts:[discord.InteractionContextType.Guild],
        integrationTypes:[discord.ApplicationIntegrationType.GuildInstall],
        options:[
            {
                name:"amount",
                description:"'all' voor alle berichten of een aantal tussen 1-100",
                type:discord.ApplicationCommandOptionType.String,
                required:true
            }
        ]
    }))
})

// REGISTER TEXT COMMAND
opendiscord.events.get("onTextCommandLoad").listen((text) => {
    const generalConfig = opendiscord.configs.get("opendiscord:general")

    text.add(new api.ODTextCommand("clear-messages:clear",{
        name:"clear-messages",
        prefix:generalConfig.data.prefix,
        dmPermission:false,
        guildPermission:true,
        options:[
            {
                type:"string",
                name:"amount",
                required:true,
                regex:/^(all|\d{1,3})$/
            }
        ]
    }))
})

// REGISTER HELP MENU
opendiscord.events.get("onHelpMenuComponentLoad").listen((menu) => {
    menu.get("opendiscord:extra").add(new api.ODHelpMenuCommandComponent("clear-messages:clear",0,{
        slashName:"clear-messages",
        textName:"clear-messages",
        slashDescription:"Schoon het kanaal op!",
        textDescription:"Schoon het kanaal op!"
    }))
})

// REGISTER EMBED BUILDER
opendiscord.events.get("onEmbedBuilderLoad").listen((embeds) => {
    const generalConfig = opendiscord.configs.get("opendiscord:general")
    
    // Success Embed
    embeds.add(new api.ODEmbed("clear-messages:clear-embed"))
    embeds.get("clear-messages:clear-embed").workers.add(
        new api.ODWorker("clear-messages:clear-embed",0,(instance,params,source,cancel) => {
            const amountText = params.custom ? `${params.amount} messages` : "Alle recente berichten";
            instance.setTitle(utilities.emojiTitle("🧹","Kanaal Opgeschoond"))
            instance.setColor(generalConfig.data.mainColor)
            instance.setDescription(`✅ ${amountText} successfully deleted!`)
            instance.setFooter("Let op: Berichten worden tot maximaal 14 dagen geleden verwijderd!")
            instance.setAuthor(params.author.displayName,params.author.displayAvatarURL())
        })
    )
    
    // Error Embed
    embeds.add(new api.ODEmbed("clear-messages:error-embed"))
    embeds.get("clear-messages:error-embed").workers.add(
        new api.ODWorker("clear-messages:error-embed",0,(instance,params,source,cancel) => {
            const generalConfig = opendiscord.configs.get("opendiscord:general")
            instance.setTitle(utilities.emojiTitle("❌","Fout opgetreden"))
            instance.setColor(0xFF0000)
            instance.setDescription(`**${params.error}**`)
        })
    )
})

// REGISTER MESSAGE BUILDER
opendiscord.events.get("onMessageBuilderLoad").listen((messages) => {
    // Success Message
    messages.add(new api.ODMessage("clear-messages:clear-message"))
    messages.get("clear-messages:clear-message").workers.add(
        new api.ODWorker("clear-messages:clear-message",0,async (instance,params,source,cancel) => {
            instance.addEmbed(await opendiscord.builders.embeds.getSafe("clear-messages:clear-embed").build(source,params))
            // ALL responses ephemeral for slash
            if (source === "slash") instance.setEphemeral(true)
        })
    )
    
    // Error Message
    messages.add(new api.ODMessage("clear-messages:error-message"))
    messages.get("clear-messages:error-message").workers.add(
        new api.ODWorker("clear-messages:error-message",0,async (instance,params,source,cancel) => {
            instance.addEmbed(await opendiscord.builders.embeds.getSafe("clear-messages:error-embed").build(source,params))
            // ALL responses ephemeral for slash
            if (source === "slash") instance.setEphemeral(true)
        })
    )
})

// REGISTER COMMAND RESPONDER
opendiscord.events.get("onCommandResponderLoad").listen((commands) => {
    const generalConfig = opendiscord.configs.get("opendiscord:general")

    commands.add(new api.ODCommandResponder("clear-messages:clear",generalConfig.data.prefix,"clear-messages"))
    commands.get("clear-messages:clear").workers.add([
        new api.ODWorker("clear-messages:clear",0,async (instance,params,source,cancel) => {
            const {guild,channel,user} = instance
            
            if (!guild){
                instance.reply(await opendiscord.builders.messages.getSafe("opendiscord:error-not-in-guild").build(source,{channel,user}))
                return cancel()
            }
            
            // Check user permissions
            const member = guild.members.cache.get(user.id) || await guild.members.fetch(user.id).catch(() => null)
            if (!member?.permissions.has(discord.PermissionsBitField.Flags.ManageMessages)) {
                instance.reply(await opendiscord.builders.messages.getSafe("opendiscord:error-no-permissions").build(source,{guild,channel,user,permissions:["admin","discord-administrator"]}))
                return cancel()
            }
            
            // Check bot permissions
            const botMember = guild.members.me
            if (!botMember?.permissions.has(discord.PermissionsBitField.Flags.ManageMessages)) {
                instance.reply(await opendiscord.builders.messages.getSafe("clear-messages:error-message").build(source,{error:"De bot heeft niet de juiste permissions om berichten te verwijderen."}))
                return cancel()
            }
            
            const amountParam = instance.options.getString("amount",true).toLowerCase()
            let amount: number
            let isCustom = false
            
            if (amountParam === "all") {
                amount = 100
            } else {
                amount = parseInt(amountParam)
                isCustom = true
                if (isNaN(amount) || amount < 1 || amount > 100) {
                    instance.reply(await opendiscord.builders.messages.getSafe("clear-messages:error-message").build(source,{error:"Ongeldig getal (1-100)."}))
                    return cancel()
                }
            }
            
            try {
                if ('bulkDelete' in channel && typeof channel.bulkDelete === 'function') {
                    const messagesToDelete = await channel.messages.fetch({ limit: amount })
                    if (messagesToDelete.size > 0) {
                        const deleted = await channel.bulkDelete(messagesToDelete, true)
                        
                        await instance.reply(await opendiscord.builders.messages.getSafe("clear-messages:clear-message").build(source,{
                            author: user,
                            amount: deleted.size,
                            custom: isCustom
                        }))
                    } else {
                        await instance.reply(await opendiscord.builders.messages.getSafe("clear-messages:error-message").build(source,{
                            error:"Er zijn geen berichten om te verwijderen."
                        }))
                    }
                } else {
                    await instance.reply(await opendiscord.builders.messages.getSafe("clear-messages:error-message").build(source,{
                        error:"Bulk opschoning is niet toegestaan."
                    }))
                }
            } catch(err: any) {
                process.emit("uncaughtException",err)
                await instance.reply(await opendiscord.builders.messages.getSafe("clear-messages:error-message").build(source,{
                    error:"Er is een fout oogetreden tijdens het verwijderen."
                }))
            }
        }),
        new api.ODWorker("clear-messages:logs",-1,(instance,params,source,cancel) => {
            const amountParam = instance.options.getString("amount",true)
            opendiscord.log(`${instance.user.displayName} used clear-messages!`,"plugin",[
                {key:"user",value:instance.user.username},
                {key:"userid",value:instance.user.id,hidden:true},
                {key:"channelid",value:instance.channel.id,hidden:true},
                {key:"amount",value:amountParam},
                {key:"method",value:source}
            ])
        })
    ])
})
